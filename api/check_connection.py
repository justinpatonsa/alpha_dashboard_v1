"""Check the read-only connection to Alpha's Supabase project.

Reads credentials from dashboard_demo/.env (never from source code), signs in
through Supabase Auth, then lists the tables this account can see with their
row counts and column names. Only GET requests touch the data: course access
is read-only and the shared database must not be modified. No row values are
printed.

    python3 api/check_connection.py                    # sign in and list tables
    python3 api/check_connection.py --change-password  # also set a new password

The new password is typed at a hidden prompt; update .env with it afterwards.
Standard library only, so it runs without installing anything.
"""
import argparse
import getpass
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / '.env'
REQUIRED = ('SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_EMAIL', 'SUPABASE_PASSWORD')
# Named in the instructor's loader script. Used when the API schema is off-limits:
# Supabase serves it only to secret keys, never to a publishable key.
KNOWN_TABLES = ('employees', 'compensation_training', 'employee_surveys', 'exit_interviews')


def load_env(path):
    if not path.exists():
        sys.exit(f'No .env at {path}\nCopy .env.example to .env and fill it in.')
    env = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        # No inline-comment stripping: passwords may contain '#'.
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    missing = [k for k in REQUIRED if not env.get(k)]
    if missing:
        sys.exit('Missing in .env: ' + ', '.join(missing))
    env['SUPABASE_URL'] = env['SUPABASE_URL'].rstrip('/')
    return env


def call(method, url, headers, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={**headers, 'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read()
            return resp.status, resp.headers, json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            payload = json.loads(raw) if raw else None
        except ValueError:
            payload = raw.decode(errors='replace')[:300]
        return err.code, err.headers, payload
    except urllib.error.URLError as err:
        sys.exit(f'Could not reach {url}: {err.reason}')


def error_text(payload):
    if isinstance(payload, dict):
        return payload.get('msg') or payload.get('message') or payload.get('error_description') or json.dumps(payload)
    return str(payload)


def sign_in(env):
    status, _, payload = call(
        'POST', f"{env['SUPABASE_URL']}/auth/v1/token?grant_type=password",
        {'apikey': env['SUPABASE_PUBLISHABLE_KEY']},
        {'email': env['SUPABASE_EMAIL'], 'password': env['SUPABASE_PASSWORD']},
    )
    if status != 200 or not isinstance(payload, dict) or 'access_token' not in payload:
        sys.exit(f'Sign-in failed (HTTP {status}): {error_text(payload)}')
    print(f"Signed in as {payload.get('user', {}).get('email', env['SUPABASE_EMAIL'])}")
    return payload['access_token']


def change_password(env, headers):
    new = getpass.getpass('New password (hidden): ')
    if not new or new != getpass.getpass('Repeat new password: '):
        sys.exit('Passwords were empty or did not match; nothing changed.')
    status, _, payload = call('PUT', f"{env['SUPABASE_URL']}/auth/v1/user", headers, {'password': new})
    if status != 200:
        sys.exit(f'Password change failed (HTTP {status}): {error_text(payload)}')
    print('Password changed. Put the new one in .env as SUPABASE_PASSWORD.')


def list_tables(env, headers):
    status, _, spec = call('GET', f"{env['SUPABASE_URL']}/rest/v1/", headers)
    if status == 200 and isinstance(spec, dict):
        tables = sorted(p.strip('/') for p in spec.get('paths', {}) if p.strip('/') and not p.startswith('/rpc/'))
        if not tables:
            print('Signed in, but the API schema lists no tables for this account.')
            return
        print(f'\n{len(tables)} table(s) or view(s) visible:\n')
    else:
        tables = KNOWN_TABLES
        print(f'API schema unavailable (HTTP {status}: {error_text(spec)}).')
        print(f'Querying the {len(tables)} tables named in the instructor\'s script instead:\n')
    for table in tables:
        status, resp_headers, rows = call(
            'GET', f"{env['SUPABASE_URL']}/rest/v1/{urllib.parse.quote(table)}?select=*&limit=1",
            {**headers, 'Prefer': 'count=exact'},
        )
        if status not in (200, 206):
            print(f'  {table}: HTTP {status} {error_text(rows)}')
            continue
        total = (resp_headers.get('Content-Range') or '').split('/')[-1] or '?'
        columns = ', '.join(rows[0].keys()) if rows else '(no rows readable)'
        print(f'  {table}  [{total} rows]\n    {columns}')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--change-password', action='store_true', help='set a new password after signing in')
    args = parser.parse_args()

    env = load_env(ENV_PATH)
    token = sign_in(env)
    headers = {'apikey': env['SUPABASE_PUBLISHABLE_KEY'], 'Authorization': f'Bearer {token}'}
    if args.change_password:
        change_password(env, headers)
    list_tables(env, headers)


if __name__ == '__main__':
    main()
