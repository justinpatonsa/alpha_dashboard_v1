"""Build the demo database: a synthetic Alpha Manufacturing workforce.

Stands in for the client's read-only Supabase project. The four tables groups
mirror the RFP's four data areas:

  employees                       employment, org assignment, departures
  compensation, training,
  hr_measures                     pay, training, selected HR measures
  surveys                         employee experience survey (partial coverage)
  exit_interviews                 reported reasons for leaving (partial coverage)

Every figure is synthetic. Departures are simulated month by month from a
hazard with a few deliberate patterns (night shift, Greenville after the July
2025 rotation change, below-market pay, heavy overtime, thin training) so the
dashboard has something real to find.

    python api/seed.py            # writes data/alpha_hr.db
"""
import math
import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "alpha_hr.db"
TODAY = date.today()
START = date(2024, 1, 1)
rng = random.Random(6520)

PLANTS = {  # plant: share of headcount, departure multiplier
    "Akron":        (0.34, 1.00),
    "Greenville":   (0.30, 1.22),
    "Fort Wayne":   (0.24, 0.92),
    "Corporate HQ": (0.12, 0.72),
}
PLANT_DEPTS = {
    "Production": 34, "Assembly": 26, "Warehouse & Logistics": 15,
    "Maintenance": 9, "Quality": 9, "Engineering": 7,
}
CORP_DEPTS = {"Engineering": 30, "Sales": 35, "Finance": 18, "HR & Admin": 17}
DEPT_ROLES = {
    "Production":            {"Machine Operator": 90, "Shift Supervisor": 7, "Manager": 3},
    "Assembly":              {"Assembler": 90, "Shift Supervisor": 7, "Manager": 3},
    "Warehouse & Logistics": {"Material Handler": 92, "Shift Supervisor": 5, "Manager": 3},
    "Maintenance":           {"Maintenance Technician": 92, "Manager": 8},
    "Quality":               {"Quality Inspector": 90, "Manager": 10},
    "Engineering":           {"Engineer": 90, "Manager": 10},
    "Sales":                 {"Sales Representative": 88, "Manager": 12},
    "Finance":               {"Analyst": 85, "Manager": 15},
    "HR & Admin":            {"HR Specialist": 85, "Manager": 15},
}
ROLE_PAY = {  # role median annual pay, departure multiplier, hourly?
    "Machine Operator":       (46_000, 1.10, True),
    "Assembler":              (42_000, 1.20, True),
    "Material Handler":       (40_000, 1.30, True),
    "Maintenance Technician": (62_000, 0.95, True),
    "Quality Inspector":      (50_000, 0.95, True),
    "Shift Supervisor":       (64_000, 0.85, True),
    "Engineer":               (92_000, 0.75, False),
    "Sales Representative":   (70_000, 1.10, False),
    "Analyst":                (74_000, 0.90, False),
    "HR Specialist":          (60_000, 0.90, False),
    "Manager":                (110_000, 0.60, False),
}
SHIFT_MULT = {"Day": 1.0, "Evening": 1.15, "Night": 1.50}

THEMES = {
    "Pay & benefits": [
        ("Higher pay elsewhere", ["Offered $3 more an hour at a distribution center.",
                                  "Pay hasn't kept up with what other plants are paying.",
                                  "Benefits got more expensive and my raise didn't cover it."]),
        ("No raise in two years", ["Two years at the same rate.",
                                   "Reviews were good but the raise never came."])],
    "Schedule & shift": [
        ("Night shift rotation", ["The new rotation meant nights every other month.",
                                  "Couldn't keep doing nights with kids at home.",
                                  "Rotation changed with a week's notice."]),
        ("Couldn't move to days", ["Asked for days for a year, list never moved.",
                                   "Seniority list for day shift is ten deep."])],
    "Workload & overtime": [
        ("Mandatory overtime", ["Mandatory Saturdays most of the summer.",
                                "Line was short-staffed so we covered every gap."]),
        ("Understaffed line", ["Doing two stations' work on a short crew.",
                               "Burned out covering for open positions."])],
    "Career growth": [
        ("No path to promotion", ["Didn't see a way up from operator.",
                                  "Lead positions go to outside hires."]),
        ("Wanted more training", ["Asked to be cross-trained on CNC, never happened.",
                                  "Onboarding was a day of videos then on the line."])],
    "Manager & team": [
        ("Supervisor relationship", ["Supervisor played favorites with overtime.",
                                     "Never got feedback until something went wrong."]),
        ("Team conflict", ["Crew didn't get along and nobody stepped in."])],
    "Working conditions": [
        ("Heat and conditions", ["Too hot on the floor in July.",
                                 "Noise and heat in the press area."]),
        ("Safety concerns", ["Near misses weren't followed up."])],
    "Personal / relocation": [
        ("Relocation", ["Moving out of state with family.", "Spouse took a job in another city."]),
        ("Returning to school", ["Going back for a nursing degree."]),
        ("Family reasons", ["Caring for a parent full time."])],
}


def pick(weights):
    keys, w = zip(*weights.items())
    return rng.choices(keys, weights=w)[0]


def month_starts(a, b):
    m = date(a.year, a.month, 1)
    while m <= b:
        yield m
        m = date(m.year + (m.month // 12), m.month % 12 + 1, 1)


def month_end(m):
    nxt = date(m.year + (m.month // 12), m.month % 12 + 1, 1)
    return nxt - timedelta(days=1)


class Person:
    _n = 0

    def __init__(self, hire_date, plant=None, dept=None, role=None, shift=None):
        Person._n += 1
        self.id = f"E{Person._n:05d}"
        self.hire = hire_date
        self.plant = plant or pick({p: v[0] for p, v in PLANTS.items()})
        corp = self.plant == "Corporate HQ"
        self.dept = dept or pick(CORP_DEPTS if corp else PLANT_DEPTS)
        self.role = role or pick(DEPT_ROLES[self.dept])
        median, _, hourly = ROLE_PAY[self.role]
        if shift:
            self.shift = shift
        elif corp or not hourly:
            self.shift = "Day" if corp or rng.random() < 0.9 else "Evening"
        else:
            self.shift = pick({"Day": 45, "Evening": 30, "Night": 25})
        # Greenville pays a little under market; everyone else centres on it.
        mu = 0.95 if self.plant == "Greenville" else 1.0
        self.pay_ratio = max(0.72, min(1.32, rng.gauss(mu, 0.075)))
        self.median = median
        self.pay = round(median * self.pay_ratio / 100) * 100
        ot_mu = (7.5 if self.plant == "Greenville" else 5.0) if hourly else 1.2
        if self.shift == "Night":
            ot_mu += 1.5
        self.overtime = round(max(0.0, rng.gammavariate(2.0, ot_mu / 2.0)), 1)
        self.training = round(max(0.0, rng.gauss(26 if hourly else 18, 11)), 1)
        sat_score = 2.9 - 2.2 * (1 - self.pay_ratio) - 0.04 * self.overtime + 0.012 * self.training \
            - (0.25 if self.shift == "Night" else 0) + rng.gauss(0, 0.7)
        self.satisfaction = int(min(4, max(1, round(sat_score))))
        self.term = None
        self.term_type = None

    def hazard(self, m):
        tenure_m = (m.year - self.hire.year) * 12 + m.month - self.hire.month
        h = 0.0098
        h *= 2.0 if tenure_m < 12 else 1.3 if tenure_m < 24 else 0.7 if tenure_m > 60 else 1.0
        h *= SHIFT_MULT[self.shift] * PLANTS[self.plant][1] * ROLE_PAY[self.role][1]
        h *= 1.55 if self.pay_ratio < 0.90 else 1.22 if self.pay_ratio < 0.97 else 0.8 if self.pay_ratio > 1.08 else 1.0
        h *= 1.45 if self.overtime > 10 else 1.15 if self.overtime > 6 else 1.0
        h *= 1.35 if self.training < 8 else 1.0
        h *= {1: 1.8, 2: 1.25, 3: 1.0, 4: 0.75}[self.satisfaction]
        h *= {1: 1.1, 6: 1.12, 7: 1.18, 8: 1.15, 12: 0.85}.get(m.month, 1.0)
        # The July 2025 rotation change at Greenville: nights and evenings now rotate.
        if self.plant == "Greenville" and self.shift in ("Night", "Evening") and m >= date(2025, 7, 1):
            h *= 1.2 if self.shift == "Night" else 1.1
        return min(h, 0.12)


def exit_theme(p):
    w = {
        "Pay & benefits": 3 + (5 if p.pay_ratio < 0.92 else 0),
        "Schedule & shift": 1 + (6 if p.shift == "Night" else 2 if p.shift == "Evening" else 0),
        "Workload & overtime": 1.5 + (4 if p.overtime > 8 else 0),
        "Career growth": 2 + (3 if p.training < 10 else 0),
        "Manager & team": 2.5,
        "Working conditions": 1.2 if ROLE_PAY[p.role][2] else 0.3,
        "Personal / relocation": 2.2,
    }
    return pick(w)


def survey_scores(p, leaver):
    def s(x):
        return int(min(5, max(1, round(x + rng.gauss(0, 0.75)))))
    lv = -0.35 if leaver else 0.0
    return dict(
        pay_benefits=s(3.3 + 4.5 * (p.pay_ratio - 1) + lv),
        workload=s(3.6 - 0.08 * p.overtime + lv),
        manager_support=s(3.5 + lv * 1.4),
        career_growth=s(2.9 + 0.025 * p.training + lv),
        safety_conditions=s(3.8 - (0.3 if ROLE_PAY[p.role][2] else 0) + lv * 0.5),
        schedule=s(3.8 - (1.2 if p.shift == "Night" else 0.4 if p.shift == "Evening" else 0) + lv),
    )


def simulate():
    people = []
    # Starting workforce on 1 Jan 2024, with a long-tailed tenure mix.
    for _ in range(1385):
        tenure_days = int(min(rng.expovariate(1 / 1700), 9000))
        people.append(Person(START - timedelta(days=tenure_days + 1)))

    for m in month_starts(START, TODAY):
        last = min(month_end(m), TODAY)
        frac = (last.day) / month_end(m).day
        leavers = []
        for p in people:
            if p.term or p.hire > last:
                continue
            if rng.random() < p.hazard(m) * frac:
                lo = max(m, p.hire + timedelta(days=1))
                p.term = lo + timedelta(days=rng.randint(0, max(0, (last - lo).days)))
                tenure = (p.term - p.hire).days
                p.term_type = "Involuntary" if rng.random() < (0.32 if tenure < 180 else 0.17) else "Voluntary"
                leavers.append(p)
        # Backfill most departures over the following weeks, plus slow growth.
        hires = int(len(leavers) * rng.uniform(0.88, 1.06)) + (1 if rng.random() < 0.55 else 0)
        for i in range(hires):
            src = leavers[i % len(leavers)] if leavers else None
            hd = m + timedelta(days=rng.randint(4, 27))
            if hd > TODAY:
                continue
            if src and rng.random() < 0.85:
                people.append(Person(hd, src.plant, src.dept, src.role, src.shift))
            else:
                people.append(Person(hd))
    return people


def build():
    people = simulate()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    db = sqlite3.connect(DB_PATH)
    db.executescript((Path(__file__).parent / "schema.sql").read_text())
    stamp = TODAY.isoformat() + "T06:00:00"

    for p in people:
        db.execute("INSERT INTO employees VALUES (?,?,?,?,?,?,?,?,?)",
                   (p.id, p.plant, p.dept, p.role, p.shift, p.hire.isoformat(),
                    p.term.isoformat() if p.term else None, p.term_type, stamp))
        if rng.random() < 0.985:
            db.execute("INSERT INTO compensation VALUES (?,?,?)", (p.id, p.pay, p.median))
        if rng.random() < 0.93:
            db.execute("INSERT INTO training VALUES (?,?)", (p.id, p.training))
        db.execute("INSERT INTO hr_measures VALUES (?,?,?)", (p.id, p.overtime, p.satisfaction))

        # Survey waves each March and September; respond to the latest wave
        # the person was employed for. Night shift answers least often.
        waves = [date(y, mo, 15) for y in (2024, 2025, 2026) for mo in (3, 9)]
        eligible = [w for w in waves if p.hire < w and (p.term is None or p.term > w) and w <= TODAY]
        resp_rate = 0.48 if p.shift == "Night" else 0.66
        if eligible and rng.random() < resp_rate:
            w = eligible[-1]
            sc = survey_scores(p, p.term is not None)
            db.execute("INSERT INTO surveys VALUES (?,?,?,?,?,?,?,?)",
                       (p.id, w.isoformat(), sc["pay_benefits"], sc["workload"], sc["manager_support"],
                        sc["career_growth"], sc["safety_conditions"], sc["schedule"]))

        if p.term and rng.random() < (0.58 if p.term_type == "Voluntary" else 0.18):
            theme = exit_theme(p)
            reason, comments = rng.choice(THEMES[theme])
            comment = rng.choice(comments) if rng.random() < 0.7 else None
            db.execute("INSERT INTO exit_interviews VALUES (?,?,?,?,?)",
                       (p.id, (p.term + timedelta(days=rng.randint(-5, 2))).isoformat(), reason, theme, comment))

    db.commit()
    n = db.execute("SELECT COUNT(*) FROM employees").fetchone()[0]
    a = db.execute("SELECT COUNT(*) FROM employees WHERE term_date IS NULL").fetchone()[0]
    d = db.execute("SELECT COUNT(*) FROM employees WHERE term_date >= '2025-10-01'").fetchone()[0]
    print(f"{DB_PATH}: {n} employee records, {a} active today, {d} departures since Oct 2025")
    db.close()


if __name__ == "__main__":
    build()
