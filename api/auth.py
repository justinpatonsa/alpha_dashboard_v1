"""Dashboard sign-in: accounts and sessions in the team's own PostgreSQL database.

This is the app database on the VPS (APP_DATABASE_URL in .env), not Alpha's
Supabase project, which stays read-only. Passwords are stored only as bcrypt
hashes and session tokens only as SHA-256 hashes, so a copy of the database
can't be used to sign in. Accounts are created with `python -m api.users`;
there is no self-service sign-up.
"""
import hashlib
import secrets

import bcrypt
import psycopg
from psycopg.rows import dict_row

from api.supabase_client import read_env

COOKIE = "mvj_session"
SESSION_HOURS = 12
MAX_PASSWORD_BYTES = 72  # bcrypt ignores anything longer

SCHEMA = """
create table if not exists app_user (
    id            bigint generated always as identity primary key,
    username      text not null unique check (username = lower(username) and username <> ''),
    display_name  text,
    password_hash text not null,           -- bcrypt, never the password itself
    disabled      boolean not null default false,
    created_at    timestamptz not null default now(),
    last_login_at timestamptz
);
create table if not exists app_session (
    id          bigint generated always as identity primary key,
    user_id     bigint not null references app_user (id) on delete cascade,
    token_hash  text not null unique,      -- SHA-256 of the cookie value
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null,
    ended_at    timestamptz,               -- set on sign-out
    ip          text,
    user_agent  text
);
create index if not exists app_session_user on app_session (user_id);
"""

# Checked against when the username doesn't exist, so a wrong username takes
# as long as a wrong password and response time doesn't reveal which accounts exist.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt(12))
_schema_ready = False


class AuthUnavailable(Exception):
    """The sign-in database isn't configured or can't be reached."""


def cookie_secure():
    return read_env().get("COOKIE_SECURE", "1").lower() not in ("0", "false", "no")


def connect():
    global _schema_ready
    url = read_env().get("APP_DATABASE_URL")
    if not url:
        raise AuthUnavailable("APP_DATABASE_URL is not set in .env")
    try:
        conn = psycopg.connect(url, connect_timeout=5, autocommit=True, row_factory=dict_row)
    except psycopg.Error as e:
        raise AuthUnavailable("Sign-in database unreachable") from e
    if not _schema_ready:
        conn.execute(SCHEMA)
        _schema_ready = True
    return conn


def normalize(username):
    return (username or "").strip().lower()


def hash_password(password):
    raw = password.encode()
    if not raw or len(raw) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be 1–{MAX_PASSWORD_BYTES} bytes")
    return bcrypt.hashpw(raw, bcrypt.gensalt(12)).decode()


def _token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _public(row):
    return {"username": row["username"], "name": row["display_name"] or row["username"]}


def sign_in(username, password, ip=None, user_agent=None):
    """Returns (token, user) on success, None on a wrong username or password."""
    with connect() as conn:
        row = conn.execute("select id, username, display_name, password_hash, disabled from app_user where username = %s",
                           (normalize(username),)).fetchone()
        stored = row["password_hash"].encode() if row else _DUMMY_HASH
        ok = bcrypt.checkpw(password.encode()[:MAX_PASSWORD_BYTES], stored)
        if not row or not ok or row["disabled"]:
            return None
        token = secrets.token_urlsafe(32)
        conn.execute(
            "insert into app_session (user_id, token_hash, expires_at, ip, user_agent) "
            "values (%s, %s, now() + make_interval(hours => %s), %s, %s)",
            (row["id"], _token_hash(token), SESSION_HOURS, ip, (user_agent or "")[:300]))
        conn.execute("update app_user set last_login_at = now() where id = %s", (row["id"],))
        return token, _public(row)


def user_for(token):
    """The signed-in user for a session cookie, or None if it's missing, ended or expired."""
    if not token:
        return None
    with connect() as conn:
        row = conn.execute(
            "select u.username, u.display_name from app_session s join app_user u on u.id = s.user_id "
            "where s.token_hash = %s and s.ended_at is null and s.expires_at > now() and not u.disabled",
            (_token_hash(token),)).fetchone()
        return _public(row) if row else None


def sign_out(token):
    if not token:
        return
    with connect() as conn:
        conn.execute("update app_session set ended_at = now() where token_hash = %s and ended_at is null",
                     (_token_hash(token),))
