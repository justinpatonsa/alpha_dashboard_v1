"""Alpha Retention Dashboard — application layer (FastAPI).

Blueprint build. Nobody has seen Alpha's schema yet, so this API never
returns a figure it can't stand behind:

  /api/status      live connection check against the Supabase project
  /api/discovery   real table names, row counts and columns once signed in
  /api/view/{id}   every view load, filter change and 15-second tick lands
                   here; it reports connection state and the query scope,
                   and `figures` stays null until metrics are mapped to
                   Alpha's confirmed fields (D1, week 2)
  /api/employees   one page of employee records, the four tables joined on
                   employee_id by Supabase (api/employees.py); searchable,
                   filterable and sortable
  /api/employees/{id}
                   every field on one employee, for the record pop-up
  /api/login, /api/logout, /api/me
                   dashboard sign-in; every other /api/ route needs a session.
                   Accounts and sessions live in the team's own Postgres
                   database (api/auth.py), never in Alpha's Supabase project.

Read-only toward Alpha by construction: the only non-GET request to Supabase
is its Auth sign-in. Every response is `Cache-Control: no-store`.

    uvicorn api.main:app --port 8000
"""
import logging
import time
from datetime import date, datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from api import auth, employees
from api.retrieval import RetrievalError
from api.supabase_client import Client

ROOT = Path(__file__).resolve().parent.parent
OUTAGE_FLAG = ROOT / ".outage"
DIST = ROOT / "frontend" / "dist"
VIEWS = {"overview", "where", "factors", "voice", "cost"}
PUBLIC_API = {"/api/login", "/api/logout", "/api/me"}

app = FastAPI(title="Alpha Retention Dashboard API", docs_url=None, redoc_url=None, openapi_url=None)
supabase = Client()
log = logging.getLogger("uvicorn.error")


@app.middleware("http")
async def require_session(request: Request, call_next):
    # Every API route except sign-in itself needs a live session cookie.
    if request.url.path.startswith("/api/") and request.url.path not in PUBLIC_API:
        try:
            user = await run_in_threadpool(auth.user_for, request.cookies.get(auth.COOKIE))
        except auth.AuthUnavailable as e:
            log.error("Sign-in database: %s", e)
            return JSONResponse({"detail": "Sign-in is unavailable right now"}, status_code=503)
        if not user:
            return JSONResponse({"detail": "Sign in required"}, status_code=401)
        request.state.user = user
    return await call_next(request)


@app.middleware("http")
async def no_store(request: Request, call_next):
    # `python demo.py outage 20` drops the API's database link for a while,
    # to show the explicit "data unavailable" state in class.
    if request.url.path.startswith("/api/") and OUTAGE_FLAG.exists():
        if time.time() < float(OUTAGE_FLAG.read_text() or 0):
            return JSONResponse({"detail": "Database connection failed"}, status_code=503,
                                headers={"Cache-Control": "no-store"})
        OUTAGE_FLAG.unlink(missing_ok=True)
    resp = await call_next(request)
    if request.url.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=200)


def client_ip(request: Request):
    # nginx passes the visitor's address; locally it's the direct peer.
    return request.headers.get("x-real-ip") or (request.client.host if request.client else None)


def unavailable(e):
    # The reason goes to the server log, not to whoever is at the sign-in page.
    log.error("Sign-in database: %s", e)
    return HTTPException(503, "Sign-in is unavailable right now")


@app.post("/api/login")
def login(creds: Credentials, request: Request, response: Response):
    try:
        result = auth.sign_in(creds.username, creds.password, client_ip(request), request.headers.get("user-agent"))
    except auth.AuthUnavailable as e:
        raise unavailable(e)
    if not result:
        raise HTTPException(401, "Incorrect username or password")
    token, user = result
    response.set_cookie(auth.COOKIE, token, max_age=auth.SESSION_HOURS * 3600, path="/",
                        httponly=True, secure=auth.cookie_secure(), samesite="strict")
    return {"user": user}


@app.post("/api/logout")
def logout(request: Request, response: Response):
    try:
        auth.sign_out(request.cookies.get(auth.COOKIE))
    except auth.AuthUnavailable as e:
        raise unavailable(e)
    response.delete_cookie(auth.COOKIE, path="/", httponly=True, secure=auth.cookie_secure(), samesite="strict")
    return {"signed_out": True}


@app.get("/api/me")
def me(request: Request):
    try:
        user = auth.user_for(request.cookies.get(auth.COOKIE))
    except auth.AuthUnavailable as e:
        raise unavailable(e)
    if not user:
        raise HTTPException(401, "Sign in required")
    return {"user": user}


def stamp():
    return datetime.now().isoformat(timespec="seconds")


def months_back(n):
    t = date.today()
    y, m = divmod(t.year * 12 + t.month - 1 - n, 12)
    return f"{y}-{m + 1:02d}"


@app.get("/api/status")
def status():
    return {**supabase.status(), "queried_at": stamp()}


@app.get("/api/meta")
def meta():
    # The period picker is a calendar, not data. Plant, department, role and
    # shift values come from Alpha's tables once those fields are confirmed.
    return {"first_month": months_back(35), "last_month": months_back(0),
            "options": {"plant": [], "department": [], "role": [], "shift": []},
            "options_source": "pending_field_mapping", "queried_at": stamp()}


@app.get("/api/discovery")
def discovery():
    return {**supabase.discover(), "queried_at": stamp()}


@app.get("/api/employees")
def employee_page(q: str = "", department: str = "", plant: str = "", status: str = "",
                  sort: str = "employee_id", desc: bool = False, page: int = 1, size: int = 50):
    try:
        result = employees.page(supabase, q, department, plant, status, sort, desc, page, size)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except RetrievalError as e:
        log.error("Employee page: %s", e)
        raise HTTPException(503, "Database query failed")
    return {**result, "options": employees.options(), "queried_at": stamp()}


@app.get("/api/employees/{employee_id}")
def employee_record(employee_id: str):
    try:
        row = employees.record(supabase, employee_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except RetrievalError as e:
        log.error("Employee record: %s", e)
        raise HTTPException(503, "Database query failed")
    if row is None:
        raise HTTPException(404, "No employee with that ID")
    return {"record": row, "queried_at": stamp()}


@app.get("/api/view/{view}")
def view(view: str, plant: str = "", department: str = "", role: str = "", shift: str = "",
         start: str = "", end: str = ""):
    if view not in VIEWS:
        raise HTTPException(404, "Unknown view")
    st = supabase.status()
    return {
        "view": view, "queried_at": stamp(), "connection": st,
        "scope": {"plant": plant, "department": department, "role": role, "shift": shift,
                  "start": start, "end": end},
        "figures": None,
        "reason": ("Metrics are mapped to Alpha's confirmed fields after the week-2 data assessment (D1). "
                   "Until then the dashboard shows what each view will answer, not numbers."),
    }


# ── Serve the built UI (one port for the demo) ────────────────────────────────

if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-store"})
