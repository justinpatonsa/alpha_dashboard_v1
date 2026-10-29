"""Manage dashboard accounts (there is no self-service sign-up).

    python -m api.users add <username> [--name "Display name"]   prompts for the password
    python -m api.users passwd <username>                          new password; ends their sessions
    python -m api.users disable <username> | enable <username>
    python -m api.users list                                       accounts and last sign-in
    python -m api.users sessions                                   the 20 most recent sign-ins
    python -m api.users import-hash <username> [--name ...]        bcrypt hash on stdin (e.g. from htpasswd)

On the VPS run these as the service user, from /var/www/mattvijayjustin:
    sudo -u mattvijayjustin venv/bin/python -m api.users list
Add --password-stdin to `add` or `passwd` to read the password from stdin instead of a prompt.
"""
import argparse
import getpass
import sys

from api import auth


def read_password(from_stdin):
    if from_stdin:
        return sys.stdin.readline().rstrip("\n")
    first = getpass.getpass("Password: ")
    if first != getpass.getpass("Repeat password: "):
        sys.exit("Passwords don't match.")
    return first


def main():
    p = argparse.ArgumentParser(prog="python -m api.users", description="Manage dashboard accounts.")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("add", "passwd", "import-hash"):
        s = sub.add_parser(name)
        s.add_argument("username")
        if name != "passwd":
            s.add_argument("--name", help="display name shown in the top bar")
        if name != "import-hash":
            s.add_argument("--password-stdin", action="store_true")
    for name in ("disable", "enable"):
        sub.add_parser(name).add_argument("username")
    sub.add_parser("list")
    sub.add_parser("sessions")
    a = p.parse_args()

    username = auth.normalize(getattr(a, "username", ""))
    with auth.connect() as conn:
        if a.cmd == "add":
            pw_hash = auth.hash_password(read_password(a.password_stdin))
            conn.execute("insert into app_user (username, display_name, password_hash) values (%s, %s, %s)",
                         (username, a.name, pw_hash))
            print(f"Added {username}.")
        elif a.cmd == "import-hash":
            pw_hash = sys.stdin.read().strip()
            if not pw_hash.startswith(("$2a$", "$2b$", "$2y$")):
                sys.exit("Expected a bcrypt hash on stdin.")
            conn.execute("insert into app_user (username, display_name, password_hash) values (%s, %s, %s) "
                         "on conflict (username) do update set password_hash = excluded.password_hash",
                         (username, a.name, pw_hash))
            print(f"Imported the password hash for {username}.")
        elif a.cmd == "passwd":
            pw_hash = auth.hash_password(read_password(a.password_stdin))
            row = conn.execute("update app_user set password_hash = %s where username = %s returning id",
                               (pw_hash, username)).fetchone()
            if not row:
                sys.exit(f"No account named {username}.")
            conn.execute("update app_session set ended_at = now() where user_id = %s and ended_at is null", (row["id"],))
            print(f"Password changed for {username}; their open sessions were signed out.")
        elif a.cmd in ("disable", "enable"):
            row = conn.execute("update app_user set disabled = %s where username = %s returning id",
                               (a.cmd == "disable", username)).fetchone()
            if not row:
                sys.exit(f"No account named {username}.")
            if a.cmd == "disable":
                conn.execute("update app_session set ended_at = now() where user_id = %s and ended_at is null", (row["id"],))
            print(f"{username} {a.cmd}d.")
        elif a.cmd == "list":
            for r in conn.execute("select username, display_name, disabled, created_at, last_login_at from app_user order by username"):
                state = "disabled" if r["disabled"] else "active"
                last = r["last_login_at"].strftime("%Y-%m-%d %H:%M") if r["last_login_at"] else "never"
                print(f"{r['username']:<20} {state:<9} last sign-in {last:<17} {r['display_name'] or ''}")
        elif a.cmd == "sessions":
            for r in conn.execute(
                    "select u.username, s.created_at, s.ended_at, s.expires_at, s.expires_at < now() as expired, s.ip "
                    "from app_session s join app_user u on u.id = s.user_id order by s.created_at desc limit 20"):
                end = (f"signed out {r['ended_at']:%Y-%m-%d %H:%M}" if r["ended_at"]
                       else "expired" if r["expired"] else f"open until {r['expires_at']:%Y-%m-%d %H:%M}")
                print(f"{r['created_at']:%Y-%m-%d %H:%M}  {r['username']:<20} {r['ip'] or '':<16} {end}")


if __name__ == "__main__":
    main()
