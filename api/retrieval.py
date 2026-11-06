"""Paged, read-only retrieval of whole tables from Alpha's Supabase project.

Supabase's API returns at most a fixed number of rows per request (its max_rows
setting, 1,000 by default), and a plain select stops there without any error. So
fetch_all() pages through a table in key order, asking for the rows after the last
key it has (keyset paging), until a page comes back empty. It doesn't rely on the
page size it asked for: if the server caps pages lower, the loop still reaches the
end.

The database's own count(*) for the table (PostgREST's `Prefer: count=exact`) is
taken in a separate request, so a retrieval can be reconciled against it. Only GET
requests touch the data, as in supabase_client.py.
"""
import urllib.parse

from api.supabase_client import KNOWN_TABLES, Client, _call, _msg, read_env

# The column each table is paged by. Each is unique and never null in the data
# (checked by discovery/profile.py); keyset paging needs that, or rows are skipped.
KEYS = {
    "employees": "employee_id",
    "compensation_training": "employee_id",
    "employee_surveys": "survey_id",
    "exit_interviews": "exit_interview_id",
}
PAGE_SIZE = 1000


class RetrievalError(Exception):
    pass


def _get(env, headers, table, query, extra=None):
    url = f"{env['SUPABASE_URL']}/rest/v1/{urllib.parse.quote(table)}?{query}"
    status, response_headers, payload = _call("GET", url, {**headers, **(extra or {})}, timeout=30)
    if status not in (200, 206):
        raise RetrievalError(f"{table}: HTTP {status}: {_msg(payload)}")
    return response_headers, payload


def _signed_in(client):
    env = read_env()
    return env, client._headers(env)


def database_count(client, table):
    """count(*) as the database reports it, from a request that returns no rows."""
    env, headers = _signed_in(client)
    response_headers, _ = _get(env, headers, table, "select=*&limit=0", {"Prefer": "count=exact"})
    total = (response_headers.get("Content-Range") or "").split("/")[-1]
    if not total.isdigit():
        raise RetrievalError(f"{table}: no count in Content-Range {response_headers.get('Content-Range')!r}")
    return int(total)


def unpaged_rows(client, table):
    """How many rows one request without paging returns: shows the API's page cap."""
    env, headers = _signed_in(client)
    _, rows = _get(env, headers, table, f"select={KEYS[table]}")
    return len(rows)


def fetch_all(client, table, columns="*", page_size=PAGE_SIZE):
    """Every row of the table, in key order, and the number of requests it took."""
    if table not in KEYS:
        raise RetrievalError(f"{table}: no paging key defined")
    key = KEYS[table]
    env, headers = _signed_in(client)
    rows, last, requests = [], None, 0
    while True:
        query = f"select={columns}&order={key}.asc&limit={page_size}"
        if last is not None:
            query += f"&{key}=gt.{urllib.parse.quote(str(last))}"
        _, page = _get(env, headers, table, query)
        requests += 1
        if not page:
            return rows, requests
        rows.extend(page)
        last = page[-1][key]


def fetch_tables(tables=KNOWN_TABLES):
    client = Client()
    return {table: fetch_all(client, table)[0] for table in tables}


_shared = Client()   # signs in on first use and reuses the session until it expires


def fetch_table(table):
    """Every row of one table, for code that loads tables by name (discovery/employee_view.py)."""
    return fetch_all(_shared, table)[0]
