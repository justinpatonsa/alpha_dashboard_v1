"""Read-only client for Alpha's Supabase project, used by the API.

Same rules as check_connection.py: credentials come from dashboard_demo/.env,
only GET requests touch data (plus the Auth sign-in), and no row values are
returned — discovery reports table names, row counts and column names only.

Every call reports what actually happened. When the publishable key hasn't
been issued yet the client still makes a real, keyless request to the project
so the dashboard can say "project reachable, awaiting key" rather than guess.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
EXAMPLE_PATH = ROOT / ".env.example"
KEYS = ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_EMAIL", "SUPABASE_PASSWORD")
# Named in the instructor's loader script. Supabase serves the API schema
# (/rest/v1/) only to secret keys, so once signed in the tables are queried by
# name and the schema is never requested: with our key it is always a 401.
KNOWN_TABLES = ("employees", "compensation_training", "employee_surveys", "exit_interviews")


def read_env():
    """Values from .env; the project URL alone may come from .env.example (it isn't secret)."""
    env = {}
    for path in (EXAMPLE_PATH, ENV_PATH):
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if path == EXAMPLE_PATH and k != "SUPABASE_URL":
                continue
            if v:
                env[k] = v
    if env.get("SUPABASE_URL"):
        env["SUPABASE_URL"] = env["SUPABASE_URL"].rstrip("/")
    return env


def _call(method, url, headers=None, body=None, timeout=10):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={**(headers or {}), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, resp.headers, json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            payload = json.loads(raw) if raw else None
        except ValueError:
            payload = raw.decode(errors="replace")[:300]
        return err.code, err.headers, payload
    except (urllib.error.URLError, TimeoutError, OSError) as err:
        return None, None, str(getattr(err, "reason", err))


def _msg(payload):
    if isinstance(payload, dict):
        return payload.get("msg") or payload.get("message") or payload.get("error_description") or json.dumps(payload)[:200]
    return str(payload)[:200]


class Client:
    def __init__(self):
        self._token = None
        self._token_exp = 0

    def _headers(self, env):
        """Signed-in headers. The Auth token is reused until it expires — that's a
        session, not a data cache; every data request still goes to the database."""
        if not self._token or time.time() > self._token_exp - 60:
            status, _, payload = _call(
                "POST", f"{env['SUPABASE_URL']}/auth/v1/token?grant_type=password",
                {"apikey": env["SUPABASE_PUBLISHABLE_KEY"]},
                {"email": env["SUPABASE_EMAIL"], "password": env["SUPABASE_PASSWORD"]},
            )
            if status != 200 or not isinstance(payload, dict) or "access_token" not in payload:
                self._token = None
                raise PermissionError(f"Sign-in failed (HTTP {status}): {_msg(payload)}")
            self._token = payload["access_token"]
            self._token_exp = time.time() + int(payload.get("expires_in", 3600))
        return {"apikey": env["SUPABASE_PUBLISHABLE_KEY"], "Authorization": f"Bearer {self._token}"}

    @staticmethod
    def _base():
        env = read_env()
        url = env.get("SUPABASE_URL")
        host = urllib.parse.urlparse(url).netloc if url else None
        return env, {"project": host, "missing": [k for k in KEYS if not env.get(k)]}

    @staticmethod
    def _link(status, payload):
        """Connection state from one data request."""
        if status is None:
            return {"state": "unreachable", "message": f"Can't reach the project: {payload}"}
        if status not in (200, 206):
            return {"state": "error", "message": f"HTTP {status}: {_msg(payload)}"}
        return {"state": "connected", "message": "Signed in, read-only."}

    def status(self):
        """One request once signed in: a zero-row read of the first known table."""
        env, base = self._base()
        url, missing = env.get("SUPABASE_URL"), base["missing"]
        if not url:
            return {**base, "state": "not_configured", "message": "No Supabase project URL configured."}

        if missing:
            # Real, keyless request: proves the project answers without pretending we can read it.
            status, _, payload = _call("GET", f"{url}/rest/v1/")
            if status is None:
                return {**base, "state": "unreachable", "message": f"Can't reach the project: {payload}"}
            return {**base, "state": "awaiting_credentials", "reachable": True,
                    "message": "Project reachable. Waiting for the publishable key before any data can be read."}

        try:
            headers = self._headers(env)
        except PermissionError as e:
            return {**base, "state": "auth_failed", "message": str(e)}
        status, _, payload = _call("GET", f"{url}/rest/v1/{KNOWN_TABLES[0]}?select=*&limit=0", headers)
        return {**base, **self._link(status, payload)}

    def discover(self):
        """Table names, exact row counts and column names. Never row values.

        One count request per table, and those requests are the connection
        check too, so status() isn't run first."""
        env, base = self._base()
        if not env.get("SUPABASE_URL") or base["missing"]:
            return {"status": self.status(), "tables": []}
        try:
            headers = self._headers(env)
        except PermissionError as e:
            return {"status": {**base, "state": "auth_failed", "message": str(e)}, "tables": []}
        results = [(name, *_call("GET", f"{env['SUPABASE_URL']}/rest/v1/{urllib.parse.quote(name)}?select=*&limit=1",
                                 {**headers, "Prefer": "count=exact"}))
                   for name in KNOWN_TABLES]
        ok = [r for r in results if r[1] in (200, 206)]
        _, status, _, payload = ok[0] if ok else results[0]
        st = {**base, **self._link(status, payload)}
        if not ok:
            return {"status": st, "tables": []}
        out = []
        for name, status, h, rows in results:
            if status not in (200, 206):
                out.append({"table": name, "error": f"HTTP {status}: {_msg(rows)}"})
                continue
            total = ((h.get("Content-Range") or "").split("/")[-1]) if h else "?"
            out.append({"table": name, "rows": int(total) if total.isdigit() else None,
                        "columns": list(rows[0].keys()) if rows else []})
        return {"status": st, "tables": out}
