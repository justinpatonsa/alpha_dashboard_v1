"""Demo controls for class — play the client committing a change to the database.

    python demo.py depart --plant Greenville --shift Night --count 5
        Records 5 departures dated today. The open dashboard picks them up on
        its next 15-second re-query (30 seconds at most), no reload.

    python demo.py undo            Puts back every departure the demo recorded.
    python demo.py outage 20       Makes the database unreachable for 20 seconds,
                                   to show the explicit "data unavailable" state.
    python demo.py reset           Rebuilds the synthetic database from scratch.
"""
import argparse
import random
import sqlite3
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / "data" / "alpha_hr.db"
OUTAGE = ROOT / "data" / "OUTAGE"


def depart(args):
    db = sqlite3.connect(DB)
    where, params = ["term_date IS NULL", "hire_date < ?"], [date.today().isoformat()]
    for col in ("plant", "department", "role", "shift"):
        val = getattr(args, col)
        if val:
            where.append(f"{col} = ?")
            params.append(val)
    ids = [r[0] for r in db.execute(f"SELECT employee_id FROM employees WHERE {' AND '.join(where)}", params)]
    if not ids:
        sys.exit("No active employees match those filters.")
    picked = random.sample(ids, min(args.count, len(ids)))
    now = datetime.now().isoformat(timespec="seconds")
    for eid in picked:
        db.execute("INSERT INTO demo_changes SELECT employee_id, term_date, term_type, ? FROM employees WHERE employee_id = ?", (now, eid))
        db.execute("UPDATE employees SET term_date = ?, term_type = 'Voluntary', updated_at = ? WHERE employee_id = ?",
                   (date.today().isoformat(), now, eid))
    db.commit()
    scope = " · ".join(v for v in (args.plant, args.department, args.role, args.shift) if v) or "anywhere"
    print(f"{datetime.now():%H:%M:%S}  committed {len(picked)} departures ({scope}), dated {date.today()}.")
    print("Watch the dashboard: the next 15-second check shows them (30 s at most).")


def undo(_):
    db = sqlite3.connect(DB)
    rows = db.execute("SELECT employee_id, prev_term_date, prev_term_type FROM demo_changes").fetchall()
    for eid, td, tt in rows:
        db.execute("UPDATE employees SET term_date = ?, term_type = ? WHERE employee_id = ?", (td, tt, eid))
    db.execute("DELETE FROM demo_changes")
    db.commit()
    print(f"Restored {len(rows)} employees.")


def outage(args):
    OUTAGE.write_text(str(time.time() + args.seconds))
    print(f"Database unreachable for {args.seconds} s. The dashboard shows 'data unavailable' on its next check, then recovers.")


def reset(_):
    OUTAGE.unlink(missing_ok=True)
    subprocess.run([sys.executable, str(ROOT / "api" / "seed.py")], check=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("depart", help="record departures dated today")
    d.add_argument("--count", type=int, default=5)
    for col in ("plant", "department", "role", "shift"):
        d.add_argument(f"--{col}")
    d.set_defaults(fn=depart)
    sub.add_parser("undo", help="restore departures the demo recorded").set_defaults(fn=undo)
    o = sub.add_parser("outage", help="simulate a lost database connection")
    o.add_argument("seconds", type=int, nargs="?", default=20)
    o.set_defaults(fn=outage)
    sub.add_parser("reset", help="rebuild the synthetic database").set_defaults(fn=reset)
    a = p.parse_args()
    a.fn(a)
