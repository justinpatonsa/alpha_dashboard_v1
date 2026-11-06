"""Employee records: Alpha's four tables joined on employee_id, read live.

Discovery (supabase_client.py) reports names and counts only. This module is the
one place the API returns row values, for the Employees reference page.

Supabase does the join itself. The three child tables have declared foreign keys
to employees and a unique employee_id (discovery/join-plan.md), so PostgREST
embeds each one as a single object, or null where the employee has no row, and
one GET returns a whole page of joined records. Nothing is cached: every page,
sort, filter, opened record and 15-second tick is a fresh query.

Filter and sort values are checked against fixed lists before they reach the
query string, so a request can only ask for what the page offers.
"""
import re

from api.retrieval import RetrievalError, _get
from api.supabase_client import read_env

# The values D1 discovery found (discovery/field-dictionary.md). They only bound
# what a filter may ask for: a value that leaves the data just matches no rows.
DEPARTMENTS = ("manufacturing", "technical", "support", "IT", "product_mng",
               "marketing", "RandD", "accounting", "hr", "management")
PLANTS = ("plant_a", "plant_b", "plant_c")
STATUSES = {
    "stayed": "left=eq.0",
    "left": "left=eq.1",
    "voluntary": "separation_type=eq.voluntary",
    "involuntary": "separation_type=eq.involuntary",
}

# Each sort key names the columns to order by; ties fall back to employee_id. Blanks
# (a stayer's departure date) go last either way, except in the "on file" columns:
# those order by the joined row's ID, and there a missing row counts as the lowest,
# so employees without one come first going up and last going down.
SORTS = {
    "employee_id": ("employee_id",),
    "status": ("left", "separation_type"),
    "department": ("department",),
    "plant": ("plant",),
    "job_role": ("job_role",),
    "shift": ("shift",),
    "hire_date": ("hire_date",),
    "departure_date": ("departure_date",),
    "annual_base_pay_usd": ("compensation_training(annual_base_pay_usd)",),
    "satisfaction_level": ("satisfaction_level",),
    "last_evaluation": ("last_evaluation",),
    "average_monthly_hours": ("average_monthly_hours",),
    "survey": ("employee_surveys(survey_id)",),
    "exit_interview": ("exit_interviews(exit_interview_id)",),
}
ON_FILE_SORTS = {"survey", "exit_interview"}
PAGE_SIZES = (25, 50, 100)

# The table view's columns; the full record asks for everything.
LIST_SELECT = ",".join([
    "employee_id", "department", "plant", "job_role", "shift", "hire_date", "departure_date",
    "separation_type", "left", "satisfaction_level", "last_evaluation", "average_monthly_hours",
    "compensation_training(salary_band,annual_base_pay_usd)",
    "employee_surveys(survey_id)", "exit_interviews(exit_interview_id)",
])
RECORD_SELECT = "*,compensation_training(*),employee_surveys(*),exit_interviews(*)"

ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,32}$")


def options():
    return {"department": list(DEPARTMENTS), "plant": list(PLANTS), "status": list(STATUSES),
            "sort": list(SORTS), "size": list(PAGE_SIZES)}


def _signed_in(client):
    env = read_env()
    try:
        return env, client._headers(env)
    except (PermissionError, KeyError) as e:
        raise RetrievalError(str(e)) from e


def page(client, q="", department="", plant="", status="", sort="employee_id", desc=False,
         number=1, size=50):
    """One page of joined records and the number of employees that match."""
    if department and department not in DEPARTMENTS:
        raise ValueError("Unknown department")
    if plant and plant not in PLANTS:
        raise ValueError("Unknown plant")
    if status and status not in STATUSES:
        raise ValueError("Unknown status")
    if sort not in SORTS:
        raise ValueError("Unknown sort column")
    if size not in PAGE_SIZES or number < 1:
        raise ValueError("Bad page")

    # Search matches the ID or the job role. Only letters, digits and spaces get
    # through; a space becomes LIKE's one-character wildcard, so "machine operator"
    # finds machine_operator.
    term = re.sub(r"[^A-Za-z0-9 ]", "", q).strip()[:24].replace(" ", "_")
    nulls = "nullsfirst" if sort in ON_FILE_SORTS and not desc else "nullslast"
    order = ",".join(f"{c}.{'desc' if desc else 'asc'}.{nulls}" for c in SORTS[sort])
    params = [f"select={LIST_SELECT}", f"order={order},employee_id.asc",
              f"limit={size}", f"offset={(number - 1) * size}"]
    if term:
        params.append(f"or=(employee_id.ilike.*{term}*,job_role.ilike.*{term}*)")
    if department:
        params.append(f"department=eq.{department}")
    if plant:
        params.append(f"plant=eq.{plant}")
    if status:
        params.append(STATUSES[status])

    env, headers = _signed_in(client)
    response_headers, rows = _get(env, headers, "employees", "&".join(params), {"Prefer": "count=exact"})
    total = (response_headers.get("Content-Range") or "").split("/")[-1]
    return {"rows": rows, "total": int(total) if total.isdigit() else None, "page": number, "size": size}


def record(client, employee_id):
    """Every field on one employee across the four tables, or None if there's no such ID."""
    if not ID_PATTERN.match(employee_id):
        raise ValueError("Bad employee ID")
    env, headers = _signed_in(client)
    _, rows = _get(env, headers, "employees", f"select={RECORD_SELECT}&employee_id=eq.{employee_id}")
    return rows[0] if rows else None
