"""Alpha Retention Dashboard — application layer (FastAPI).

Every endpoint opens the database read-only and queries it on each request:
no cache, no CSV extracts, `Cache-Control: no-store` on every response. The
React UI re-queries the active view every 15 seconds, so a committed change
shows within the 30-second limit without a reload.

In production this reads Alpha's Supabase project with a server-side read-only
key; for the demo it reads data/alpha_hr.db, built by api/seed.py.

    uvicorn api.main:app --port 8000
"""
import math
import sqlite3
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "alpha_hr.db"
OUTAGE_FLAG = ROOT / "data" / "OUTAGE"
DIST = ROOT / "frontend" / "dist"

DIMENSIONS = {"plant": "Plant", "department": "Department", "role": "Role", "shift": "Shift"}
SMALL_GROUP = 10        # groups averaging fewer employees are flagged, not ranked
WELL_ABOVE = 1.20       # "well above the company level" = 20% or more above

# Replacement cost per departure (Proposal 3.2). Low / base / high, each
# labelled with where the number comes from. Pay is per employee from the
# compensation table; the rest are assumptions until Alpha supplies figures.
COST_ASSUMPTIONS = {
    "recruiting":     {"label": "Recruiting cost per hire", "unit": "usd", "low": 1500, "base": 3000, "high": 4700,
                       "source": "Assumption", "help": "Advertising, agency and recruiter time to fill one role."},
    "onboarding":     {"label": "Onboarding and training per hire", "unit": "usd", "low": 1200, "base": 2500, "high": 4000,
                       "source": "Assumption", "help": "Orientation, safety certification and trainer time."},
    "vacancy_weeks":  {"label": "Weeks a role sits vacant", "unit": "weeks", "low": 3, "base": 5, "high": 8,
                       "source": "Assumption", "help": "Covered with overtime at 1.5x; the unpaid salary is netted off, so the cost is the 0.5x premium."},
    "ramp_weeks":     {"label": "Weeks to full productivity", "unit": "weeks", "low": 6, "base": 10, "high": 16,
                       "source": "Assumption", "help": "A new hire averages half productivity over the ramp-up."},
    "pay":            {"label": "Annual pay of each leaver", "unit": "table", "source": "Client-supplied",
                       "help": "compensation.annual_pay; role median where a row is missing."},
}
OVERTIME_PREMIUM_NET = 0.5   # 1.5x cover minus the salary not paid
RAMP_GAP = 0.5               # half productivity during ramp-up

app = FastAPI(title="Alpha Retention Dashboard API")


@app.middleware("http")
async def no_store(request: Request, call_next):
    if request.url.path.startswith("/api/") and OUTAGE_FLAG.exists():
        until = float(OUTAGE_FLAG.read_text() or 0)
        if time.time() < until:
            return JSONResponse({"detail": "Database connection failed"}, status_code=503,
                                headers={"Cache-Control": "no-store"})
        OUTAGE_FLAG.unlink(missing_ok=True)
    resp = await call_next(request)
    if request.url.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


def connect():
    if not DB_PATH.exists():
        raise HTTPException(503, "Database not found — run python api/seed.py")
    db = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    return db


# ── Filters and periods ───────────────────────────────────────────────────────

def as_of():
    return date.today()


def month_floor(ym):
    y, m = map(int, ym.split("-"))
    return date(y, m, 1)


def add_months(d, n):
    y, m = divmod(d.month - 1 + n, 12)
    return date(d.year + y, m + 1, 1)


def month_last(d):
    return add_months(d, 1) - timedelta(days=1)


class Filters:
    def __init__(self, plant, department, role, shift, start, end):
        self.values = {"plant": plant, "department": department, "role": role, "shift": shift}
        today = as_of()
        end_m = month_floor(end) if end else date(today.year, today.month, 1)
        start_m = month_floor(start) if start else add_months(end_m, -11)
        if start_m > end_m:
            start_m, end_m = end_m, start_m
        self.start = start_m
        self.end_month = end_m
        self.end = min(month_last(end_m), today)       # last day counted
        self.months = (end_m.year - start_m.year) * 12 + end_m.month - start_m.month + 1

    def where(self, alias="e"):
        clauses, params = [], []
        for col, val in self.values.items():
            if val:
                clauses.append(f"{alias}.{col} = ?")
                params.append(val)
        return (" AND ".join(clauses) or "1=1"), params

    def prior(self):
        p = Filters.__new__(Filters)
        p.values = self.values
        p.end_month = add_months(self.start, -1)
        p.start = add_months(self.start, -self.months)
        p.end = month_last(p.end_month)
        p.months = self.months
        return p

    def describe(self):
        return {"start": self.start.isoformat()[:7], "end": self.end_month.isoformat()[:7],
                "through": self.end.isoformat(), "months": self.months}


def filters(plant: str = "", department: str = "", role: str = "", shift: str = "",
            start: str = "", end: str = ""):
    return Filters(plant, department, role, shift, start, end)


# ── Core measures ─────────────────────────────────────────────────────────────

def monthly(db, f, group_sql=None):
    """Headcount at start/end, departures and voluntary departures per month
    (and per group). Month end is capped at today for the current month."""
    where, params = f.where()
    g = group_sql or "'All'"
    sql = f"""
    WITH RECURSIVE months(ms) AS (
      SELECT ? UNION ALL SELECT date(ms, '+1 month') FROM months WHERE ms < ?
    ), bounds AS (
      SELECT ms, MIN(date(ms, '+1 month', '-1 day'), ?) AS me FROM months
    )
    SELECT {g} AS grp, b.ms AS month,
      SUM(e.hire_date < b.ms AND (e.term_date IS NULL OR e.term_date >= b.ms)) AS hc_start,
      SUM(e.hire_date <= b.me AND (e.term_date IS NULL OR e.term_date > b.me))  AS hc_end,
      SUM(e.term_date BETWEEN b.ms AND b.me)                                    AS deps,
      SUM(e.term_date BETWEEN b.ms AND b.me AND e.term_type = 'Voluntary')      AS vol
    FROM bounds b CROSS JOIN employees e
    WHERE {where}
    GROUP BY grp, b.ms ORDER BY grp, b.ms
    """
    rows = db.execute(sql, [f.start.isoformat(), f.end_month.isoformat(), f.end.isoformat(), *params]).fetchall()
    return [dict(r) for r in rows]


def summarize(rows):
    if not rows:
        return {"avg_hc": 0, "deps": 0, "vol": 0, "rate": None, "hc_start": 0, "hc_end": 0}
    avgs = [(r["hc_start"] + r["hc_end"]) / 2 for r in rows]
    avg_hc = sum(avgs) / len(avgs)
    deps = sum(r["deps"] for r in rows)
    vol = sum(r["vol"] for r in rows)
    return {
        "avg_hc": avg_hc, "deps": deps, "vol": vol,
        "rate": deps / avg_hc if avg_hc else None,
        "hc_start": rows[0]["hc_start"], "hc_end": rows[-1]["hc_end"],
    }


def retention(db, f):
    where, params = f.where()
    r = db.execute(f"""
      SELECT SUM(hire_date < ? AND (term_date IS NULL OR term_date >= ?)) AS at_start,
             SUM(hire_date < ? AND (term_date IS NULL OR term_date >= ?) AND (term_date IS NULL OR term_date > ?)) AS kept
      FROM employees e WHERE {where}""",
                   [f.start.isoformat(), f.start.isoformat(), f.start.isoformat(), f.start.isoformat(),
                    f.end.isoformat(), *params]).fetchone()
    return (r["kept"] / r["at_start"]) if r["at_start"] else None


def leaver_pay(db, f):
    where, params = f.where()
    rows = db.execute(f"""
      SELECT e.plant, e.shift, e.department, e.role,
             COALESCE(c.annual_pay, (SELECT AVG(role_median_pay) FROM compensation c2
                                      JOIN employees e2 USING (employee_id) WHERE e2.role = e.role)) AS pay
      FROM employees e LEFT JOIN compensation c USING (employee_id)
      WHERE e.term_date BETWEEN ? AND ? AND {where}""",
                      [f.start.isoformat(), f.end.isoformat(), *params]).fetchall()
    return [dict(r) for r in rows]


def replacement_cost(n, pay_sum, level="base"):
    a = {k: v[level] for k, v in COST_ASSUMPTIONS.items() if level in v}
    weekly = pay_sum / 52
    return (n * (a["recruiting"] + a["onboarding"])
            + weekly * a["vacancy_weeks"] * OVERTIME_PREMIUM_NET
            + weekly * a["ramp_weeks"] * RAMP_GAP)


def pct_change(a, b):
    return None if not b or a is None else (a - b) / b


# ── Endpoints ─────────────────────────────────────────────────────────────────

def stamp():
    return datetime.now().isoformat(timespec="seconds")


@app.get("/api/meta")
def meta():
    db = connect()
    opts = {k: [r[0] for r in db.execute(f"SELECT DISTINCT {k} FROM employees ORDER BY 1")] for k in DIMENSIONS}
    first = db.execute("SELECT MIN(term_date) FROM employees").fetchone()[0]
    today = as_of()
    return {"options": opts, "first_month": "2024-01", "last_month": today.isoformat()[:7],
            "as_of": today.isoformat(), "queried_at": stamp(), "first_departure": first}


@app.get("/api/overview")
def overview(plant: str = "", department: str = "", role: str = "", shift: str = "", start: str = "", end: str = ""):
    f = filters(plant, department, role, shift, start, end)
    db = connect()
    rows = monthly(db, f)
    s = summarize(rows)
    p = summarize(monthly(db, f.prior()))
    pays = leaver_pay(db, f)
    prior_pays = leaver_pay(db, f.prior())
    cost = replacement_cost(len(pays), sum(r["pay"] for r in pays))
    prior_cost = replacement_cost(len(prior_pays), sum(r["pay"] for r in prior_pays))
    ret, prior_ret = retention(db, f), retention(db, f.prior())

    trend = [{
        "month": r["month"][:7], "hc": (r["hc_start"] + r["hc_end"]) / 2, "deps": r["deps"],
        "vol": r["vol"], "invol": r["deps"] - r["vol"],
        "rate": r["deps"] / ((r["hc_start"] + r["hc_end"]) / 2) if r["hc_start"] + r["hc_end"] else None,
        "partial": r["month"][:7] == as_of().isoformat()[:7],
    } for r in rows]

    # Teasers for the other views: hottest plant x shift groups, top exit themes.
    groups = group_rates(db, f, "e.plant || ' · ' || e.shift")
    hot = [g for g in groups if not g["small"]][:3]
    where, params = f.where()
    themes = [dict(r) for r in db.execute(f"""
      SELECT x.theme, COUNT(*) AS n FROM exit_interviews x JOIN employees e USING (employee_id)
      WHERE e.term_date BETWEEN ? AND ? AND {where} GROUP BY x.theme ORDER BY n DESC""",
                                           [f.start.isoformat(), f.end.isoformat(), *params])]
    return {
        "period": f.describe(), "queried_at": stamp(),
        "kpis": {
            "headcount": s["hc_end"], "avg_hc": s["avg_hc"], "prior_headcount": p["hc_end"],
            "departures": s["deps"], "prior_departures": p["deps"],
            "rate": s["rate"], "prior_rate": p["rate"],
            "retention": ret, "prior_retention": prior_ret,
            "voluntary_share": s["vol"] / s["deps"] if s["deps"] else None,
            "cost": cost, "prior_cost": prior_cost,
        },
        "deltas": {
            "departures": pct_change(s["deps"], p["deps"]), "rate": pct_change(s["rate"], p["rate"]),
            "retention": pct_change(ret, prior_ret), "cost": pct_change(cost, prior_cost),
            "headcount": pct_change(s["hc_end"], p["hc_end"]),
        },
        "trend": trend,
        "hot_groups": hot, "company_rate": s["rate"],
        "themes": themes, "exit_count": sum(t["n"] for t in themes),
    }


def group_rates(db, f, group_sql):
    rows = monthly(db, f, group_sql)
    company = summarize(monthly(db, f))
    by = {}
    for r in rows:
        by.setdefault(r["grp"], []).append(r)
    out = []
    for g, rs in by.items():
        s = summarize(rs)
        if s["avg_hc"] == 0 and s["deps"] == 0:
            continue
        ratio = (s["rate"] / company["rate"]) if s["rate"] is not None and company["rate"] else None
        out.append({
            "group": g, "avg_hc": round(s["avg_hc"], 1), "departures": s["deps"], "rate": s["rate"],
            "vs_company": ratio, "small": s["avg_hc"] < SMALL_GROUP,
            "well_above": bool(ratio and ratio >= WELL_ABOVE and s["avg_hc"] >= SMALL_GROUP),
        })
    out.sort(key=lambda x: (x["small"], -(x["rate"] or 0)))
    return out


@app.get("/api/where")
def where_view(plant: str = "", department: str = "", role: str = "", shift: str = "", start: str = "", end: str = ""):
    f = filters(plant, department, role, shift, start, end)
    db = connect()
    company = summarize(monthly(db, f))
    dims = {k: group_rates(db, f, f"e.{k}") for k in DIMENSIONS}
    grid = group_rates(db, f, "e.plant || '|' || e.shift")
    matrix = []
    for g in grid:
        pl, sh = g["group"].split("|")
        matrix.append({**g, "plant": pl, "shift": sh})
    return {"period": f.describe(), "queried_at": stamp(), "company_rate": company["rate"],
            "company_deps": company["deps"], "company_hc": company["avg_hc"],
            "dimensions": dims, "matrix": matrix, "small_threshold": SMALL_GROUP, "well_above": WELL_ABOVE}


# ── Factors: leavers vs stayers ───────────────────────────────────────────────

FACTORS = [
    {"key": "pay_ratio", "label": "Pay vs role median", "unit": "ratio", "source": "compensation",
     "bands": [(None, 0.90, "< 90%"), (0.90, 0.97, "90–97%"), (0.97, 1.03, "97–103%"), (1.03, 1.10, "103–110%"), (1.10, None, "> 110%")],
     "risk": (None, 0.97), "risk_label": "Paid below 97% of role median", "ref_label": "97% or more"},
    {"key": "overtime", "label": "Weekly overtime hours", "unit": "hrs", "source": "hr_measures",
     "bands": [(None, 3, "0–3"), (3, 6, "3–6"), (6, 10, "6–10"), (10, None, "10+")],
     "risk": (6, None), "risk_label": "More than 6 overtime hrs/week", "ref_label": "6 or fewer"},
    {"key": "training", "label": "Training hours, last 12 months", "unit": "hrs", "source": "training",
     "bands": [(None, 8, "< 8"), (8, 20, "8–20"), (20, 35, "20–35"), (35, None, "35+")],
     "risk": (None, 8), "risk_label": "Under 8 training hours", "ref_label": "8 or more"},
    {"key": "satisfaction", "label": "Job satisfaction (1–4)", "unit": "score", "source": "hr_measures",
     "bands": [(None, 1.5, "1 · Low"), (1.5, 2.5, "2"), (2.5, 3.5, "3"), (3.5, None, "4 · High")],
     "risk": (None, 2.5), "risk_label": "Satisfaction 1–2", "ref_label": "3–4"},
]


def in_band(v, lo, hi):
    return (lo is None or v >= lo) and (hi is None or v < hi)


def wilson(k, n, z=1.96):
    if n == 0:
        return None, None
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0, c - h), min(1, c + h)


def p_from_z(z):
    return math.erfc(abs(z) / math.sqrt(2))


def welch(a, b):
    if len(a) < 2 or len(b) < 2:
        return None, None
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    va = sum((x - ma) ** 2 for x in a) / (len(a) - 1)
    vb = sum((x - mb) ** 2 for x in b) / (len(b) - 1)
    se = math.sqrt(va / len(a) + vb / len(b))
    return (ma - mb), (p_from_z((ma - mb) / se) if se else None)


@app.get("/api/factors")
def factors_view(plant: str = "", department: str = "", role: str = "", shift: str = "", start: str = "", end: str = ""):
    f = filters(plant, department, role, shift, start, end)
    db = connect()
    where, params = f.where()
    rows = [dict(r) for r in db.execute(f"""
      SELECT e.employee_id, COALESCE(e.term_date BETWEEN ? AND ?, 0) AS left_,
             c.annual_pay / c.role_median_pay AS pay_ratio,
             h.overtime_hours_wk AS overtime, t.training_hours_12m AS training, h.job_satisfaction AS satisfaction
      FROM employees e
      LEFT JOIN compensation c USING (employee_id)
      LEFT JOIN training t USING (employee_id)
      LEFT JOIN hr_measures h USING (employee_id)
      WHERE e.hire_date <= ? AND (e.term_date IS NULL OR e.term_date >= ?) AND {where}""",
                                        [f.start.isoformat(), f.end.isoformat(), f.end.isoformat(), f.start.isoformat(), *params])]
    pop = len(rows)
    out = []
    for fac in FACTORS:
        k = fac["key"]
        have = [r for r in rows if r[k] is not None]
        bands = []
        for lo, hi, label in fac["bands"]:
            b = [r for r in have if in_band(r[k], lo, hi)]
            n, kk = len(b), sum(r["left_"] for r in b)
            ci = wilson(kk, n)
            bands.append({"band": label, "n": n, "leavers": kk, "share": kk / n if n else None,
                          "lo": ci[0], "hi": ci[1], "small": n < SMALL_GROUP})
        risk = [r for r in have if in_band(r[k], *fac["risk"])]
        ref = [r for r in have if not in_band(r[k], *fac["risk"])]
        p1 = sum(r["left_"] for r in risk) / len(risk) if risk else None
        p0 = sum(r["left_"] for r in ref) / len(ref) if ref else None
        diff = lo_ = hi_ = pval = None
        if p1 is not None and p0 is not None:
            diff = p1 - p0
            se = math.sqrt(p1 * (1 - p1) / len(risk) + p0 * (1 - p0) / len(ref))
            lo_, hi_ = diff - 1.96 * se, diff + 1.96 * se
            pool = (p1 * len(risk) + p0 * len(ref)) / (len(risk) + len(ref))
            se0 = math.sqrt(pool * (1 - pool) * (1 / len(risk) + 1 / len(ref)))
            pval = p_from_z(diff / se0) if se0 else None
        lv = [r[k] for r in have if r["left_"]]
        st = [r[k] for r in have if not r["left_"]]
        mdiff, mp = welch(lv, st)
        out.append({
            "key": k, "label": fac["label"], "unit": fac["unit"], "source": fac["source"],
            "coverage": len(have) / pop if pop else 0, "n": len(have),
            "bands": bands,
            "risk_label": fac["risk_label"], "ref_label": fac["ref_label"],
            "risk_n": len(risk), "ref_n": len(ref), "risk_share": p1, "ref_share": p0,
            "diff": diff, "diff_lo": lo_, "diff_hi": hi_, "p_value": pval,
            "leaver_mean": sum(lv) / len(lv) if lv else None, "stayer_mean": sum(st) / len(st) if st else None,
            "leaver_n": len(lv), "stayer_n": len(st), "mean_diff": mdiff, "mean_p": mp,
        })
    leavers = sum(r["left_"] for r in rows)
    return {"period": f.describe(), "queried_at": stamp(), "population": pop, "leavers": leavers,
            "base_share": leavers / pop if pop else None, "factors": out}


# ── Employee voice ────────────────────────────────────────────────────────────

SURVEY_DIMS = [("pay_benefits", "Pay and benefits"), ("workload", "Workload"), ("schedule", "Schedule and shift"),
               ("manager_support", "Manager support"), ("career_growth", "Career growth"),
               ("safety_conditions", "Safety and conditions")]


@app.get("/api/voice")
def voice_view(plant: str = "", department: str = "", role: str = "", shift: str = "", start: str = "", end: str = ""):
    f = filters(plant, department, role, shift, start, end)
    db = connect()
    where, params = f.where()
    span = [f.start.isoformat(), f.end.isoformat()]
    pop_sql = f"e.hire_date <= ? AND (e.term_date IS NULL OR e.term_date >= ?) AND {where}"
    pop_params = [f.end.isoformat(), f.start.isoformat(), *params]
    pop = db.execute(f"SELECT COUNT(*) FROM employees e WHERE {pop_sql}", pop_params).fetchone()[0]
    cols = ", ".join(f"s.{c}" for c, _ in SURVEY_DIMS)
    srows = [dict(r) for r in db.execute(f"""
      SELECT COALESCE(e.term_date BETWEEN ? AND ?, 0) AS left_, {cols}
      FROM surveys s JOIN employees e USING (employee_id) WHERE {pop_sql}""", [*span, *pop_params])]
    dims = []
    for c, label in SURVEY_DIMS:
        lv = [r[c] for r in srows if r["left_"] and r[c] is not None]
        st = [r[c] for r in srows if not r["left_"] and r[c] is not None]
        d, p = welch(lv, st)
        dims.append({"key": c, "label": label,
                     "leavers": sum(lv) / len(lv) if lv else None, "stayers": sum(st) / len(st) if st else None,
                     "diff": d, "p_value": p, "fav_stayers": sum(1 for x in st if x >= 4) / len(st) if st else None})

    deps = db.execute(f"SELECT COUNT(*) FROM employees e WHERE e.term_date BETWEEN ? AND ? AND {where}",
                      [*span, *params]).fetchone()[0]
    exits = [dict(r) for r in db.execute(f"""
      SELECT x.theme, x.reason, x.comment, e.plant, e.shift, e.role, e.term_type, e.term_date
      FROM exit_interviews x JOIN employees e USING (employee_id)
      WHERE e.term_date BETWEEN ? AND ? AND {where} ORDER BY e.term_date DESC""", [*span, *params])]
    themes = {}
    for x in exits:
        t = themes.setdefault(x["theme"], {"theme": x["theme"], "n": 0, "reasons": {}, "by_shift": {}})
        t["n"] += 1
        t["reasons"][x["reason"]] = t["reasons"].get(x["reason"], 0) + 1
        t["by_shift"][x["shift"]] = t["by_shift"].get(x["shift"], 0) + 1
    theme_list = sorted(themes.values(), key=lambda t: -t["n"])
    for t in theme_list:
        t["share"] = t["n"] / len(exits) if exits else None
        t["reasons"] = sorted(({"reason": k, "n": v} for k, v in t["reasons"].items()), key=lambda r: -r["n"])
    shift_tot = {}
    for x in exits:
        shift_tot[x["shift"]] = shift_tot.get(x["shift"], 0) + 1
    comments = [{k: x[k] for k in ("theme", "reason", "comment", "plant", "shift", "role")} | {"month": x["term_date"][:7]}
                for x in exits if x["comment"]][:8]
    return {
        "period": f.describe(), "queried_at": stamp(),
        "survey": {"population": pop, "respondents": len(srows), "coverage": len(srows) / pop if pop else 0,
                   "leaver_respondents": sum(r["left_"] for r in srows),
                   "stayer_respondents": sum(1 for r in srows if not r["left_"]), "dimensions": dims},
        "exit": {"departures": deps, "interviews": len(exits), "coverage": len(exits) / deps if deps else 0,
                 "themes": theme_list, "shift_totals": shift_tot, "comments": comments},
    }


# ── Cost and scenarios ────────────────────────────────────────────────────────

@app.get("/api/cost")
def cost_view(plant: str = "", department: str = "", role: str = "", shift: str = "", start: str = "", end: str = ""):
    f = filters(plant, department, role, shift, start, end)
    db = connect()
    company = summarize(monthly(db, f))
    pays = leaver_pay(db, f)
    groups = group_rates(db, f, "e.plant || ' · ' || e.shift")
    eligible = [g for g in groups if not g["small"] and g["rate"] is not None]
    top2 = eligible[:2]
    pay_by_group = {}
    for r in pays:
        key = f"{r['plant']} · {r['shift']}"
        pay_by_group[key] = pay_by_group.get(key, 0) + r["pay"]
    for g in groups:
        g["pay_sum"] = pay_by_group.get(g["group"], 0)
    # Inputs for the recommendations, from people still employed at period end.
    where, params = f.where()
    active = [dict(r) for r in db.execute(f"""
      SELECT c.annual_pay, c.role_median_pay, h.overtime_hours_wk AS ot
      FROM employees e LEFT JOIN compensation c USING (employee_id) LEFT JOIN hr_measures h USING (employee_id)
      WHERE e.hire_date <= ? AND (e.term_date IS NULL OR e.term_date > ?) AND {where}""",
                                           [f.end.isoformat(), f.end.isoformat(), *params])]
    below = [r for r in active if r["annual_pay"] and r["annual_pay"] < 0.97 * r["role_median_pay"]]
    deep = [r for r in active if r["annual_pay"] and r["annual_pay"] < 0.90 * r["role_median_pay"]]
    heavy = [r for r in active if r["ot"] is not None and r["ot"] > 6]
    excess = sum(r["ot"] - 6 for r in heavy)
    levers = {
        "active": len(active),
        "below_market_n": len(below),
        "below_market_cost": sum(0.97 * r["role_median_pay"] - r["annual_pay"] for r in below),
        "deep_below_n": len(deep),     # under 90% of median, lifted to 90%
        "deep_below_cost": sum(0.90 * r["role_median_pay"] - r["annual_pay"] for r in deep),
        "heavy_ot_n": len(heavy),
        "excess_ot_hours_wk": excess,
        "float_positions": excess / 40,
    }
    by_role = {}
    for r in pays:
        b = by_role.setdefault(r["role"], {"role": r["role"], "n": 0, "pay_sum": 0})
        b["n"] += 1
        b["pay_sum"] += r["pay"]
    return {
        "period": f.describe(), "queried_at": stamp(),
        "assumptions": COST_ASSUMPTIONS, "overtime_premium_net": OVERTIME_PREMIUM_NET, "ramp_gap": RAMP_GAP,
        "departures": len(pays), "pay_sum": sum(r["pay"] for r in pays),
        "avg_hc": company["avg_hc"], "rate": company["rate"],
        "annualize": 12 / f.months,
        "groups": groups, "top2": [g["group"] for g in top2], "levers": levers,
        "by_role": sorted(by_role.values(), key=lambda b: -b["n"]),
    }


# ── Definitions and data coverage ─────────────────────────────────────────────

@app.get("/api/coverage")
def coverage():
    db = connect()
    total = db.execute("SELECT COUNT(*) FROM employees").fetchone()[0]
    leavers = db.execute("SELECT COUNT(*) FROM employees WHERE term_date IS NOT NULL").fetchone()[0]
    def one(sql):
        return db.execute(sql).fetchone()[0]
    tables = [
        {"table": "employees", "area": "Employment and departures", "rows": total, "covers": total, "of": total,
         "basis": "all employee records", "dates": f"{one('SELECT MIN(hire_date) FROM employees')[:7]} → {one('SELECT MAX(COALESCE(term_date, hire_date)) FROM employees')[:7]}"},
        {"table": "compensation", "area": "Pay", "rows": one("SELECT COUNT(*) FROM compensation"),
         "covers": one("SELECT COUNT(*) FROM compensation"), "of": total, "basis": "employees", "dates": "current"},
        {"table": "training", "area": "Development", "rows": one("SELECT COUNT(*) FROM training"),
         "covers": one("SELECT COUNT(*) FROM training"), "of": total, "basis": "employees", "dates": "last 12 months"},
        {"table": "hr_measures", "area": "Workload and satisfaction", "rows": one("SELECT COUNT(*) FROM hr_measures"),
         "covers": one("SELECT COUNT(*) FROM hr_measures"), "of": total, "basis": "employees", "dates": "last 12 months"},
        {"table": "surveys", "area": "Employee experience survey", "rows": one("SELECT COUNT(*) FROM surveys"),
         "covers": one("SELECT COUNT(*) FROM surveys"), "of": total, "basis": "employees",
         "dates": f"{one('SELECT MIN(survey_date) FROM surveys')[:7]} → {one('SELECT MAX(survey_date) FROM surveys')[:7]}"},
        {"table": "exit_interviews", "area": "Reported reasons for leaving", "rows": one("SELECT COUNT(*) FROM exit_interviews"),
         "covers": one("SELECT COUNT(*) FROM exit_interviews"), "of": leavers, "basis": "departures",
         "dates": f"{one('SELECT MIN(interview_date) FROM exit_interviews')[:7]} → {one('SELECT MAX(interview_date) FROM exit_interviews')[:7]}"},
    ]
    for t in tables:
        t["coverage"] = t["covers"] / t["of"] if t["of"] else 0
    return {"queried_at": stamp(), "tables": tables,
            "checks": [
                {"check": "Every departure has a date and a type", "ok": one("SELECT COUNT(*) FROM employees WHERE term_date IS NOT NULL AND term_type IS NULL") == 0},
                {"check": "No departure dated before hire", "ok": one("SELECT COUNT(*) FROM employees WHERE term_date < hire_date") == 0},
                {"check": "Plant, department, role and shift filled on every record", "ok": one("SELECT COUNT(*) FROM employees WHERE plant IS NULL OR department IS NULL OR role IS NULL OR shift IS NULL") == 0},
                {"check": "Exit interviews only for employees who left", "ok": one("SELECT COUNT(*) FROM exit_interviews x JOIN employees e USING (employee_id) WHERE e.term_date IS NULL") == 0},
            ]}


@app.get("/api/health")
def health():
    connect().execute("SELECT 1")
    return {"ok": True, "queried_at": stamp()}


# ── Serve the built UI (one port for the demo) ────────────────────────────────

if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-store"})
