# Alpha Retention Dashboard: blueprint build

Protea Consulting Group · DATA 6520 · Alpha Manufacturing RFP

This is the dashboard we proposed, built before anyone has seen Alpha's data.
The RFP says no schema, field list or sample data is given at the proposal
stage, so this build **shows no numbers it can't read from the database**.
Everything on screen is one of three things:

- **Real.** The live connection check (a request to Alpha's Supabase project
  every 15 seconds), the "data unavailable" state, and Data discovery, which
  lists the actual tables, row counts and columns as soon as access is granted.
- **A commitment from the proposal.** These are the metric definitions
  (population, period, numerator, denominator), the research question and
  decision behind each view, and the D4/D5 acceptance tests.
- **An empty frame.** Tiles show "—" with "Awaiting data access", and charts
  are dashed wireframes that say what each mark will mean and what data it
  needs.

The cost model is the exception. It is a working calculator built on the
formula in Proposal 6.2, and its inputs start empty.

## Run it

```bash
./run.sh
```

Then open http://localhost:8000. This needs Python 3 with the packages in
`requirements.txt`, plus Node and a Postgres database for sign-in (see below).
The script installs anything that's missing.

When the Supabase publishable key arrives, copy `.env.example` to `.env`, fill
it in and restart. You can also run `python3 api/check_connection.py` first.
The status bar turns green and Data discovery fills in. Access is read-only:
the only request the app ever writes is the sign-in.

## Sign-in

The dashboard opens on a sign-in page. Accounts and sessions are stored in
the team's own PostgreSQL database (`APP_DATABASE_URL` in `.env`), never in
Alpha's Supabase project. Passwords are kept only as bcrypt hashes and session
cookies only as SHA-256 hashes. Sessions last 12 hours, and **Sign out** in the
account menu ends one at once. There is no self-service sign-up; manage
accounts with:

```bash
python3 -m api.users add <username> --name "Display name"   # prompts for the password
python3 -m api.users list                                    # accounts and last sign-in
python3 -m api.users sessions                                # recent sign-ins and sign-outs
python3 -m api.users passwd <username>                       # also signs them out everywhere
python3 -m api.users disable <username>
```

On the VPS the database is `mattvijayjustin` (peer auth, no password), so run
these as the service user from `/var/www/mattvijayjustin`:
`sudo -u mattvijayjustin venv/bin/python -m api.users list`.

Locally, use Postgres.app with `APP_DATABASE_URL=postgresql://localhost/alpha_dashboard_dev`
and `COOKIE_SECURE=0` in `.env`. The tables are created on first use.

## Demo run-sheet (about 6 minutes)

1. **Status bar (top right).** "Awaiting access key · time · countdown." This
   is a real request to Alpha's project, repeated every 15 seconds. Hover it
   for the detail.
2. **Data discovery.** Read the RFP quote. Show the four data areas and what
   the week-2 assessment confirms. "When the key lands, this table becomes the
   real list of tables, live."
3. **Overview.**
   - The subtitle is the research question (SQ1).
   - Hover the **?** on Departure rate to show the definition.
   - Click **YTD** or **24M**. The trend axis changes and the status-bar time
     updates, because every change is a fresh query.
4. **Where, Factors, Employee voice.** About 20 seconds each. Read the
   question in the subtitle, and hover a card's **?** to show what it will
   draw. Say that factors are associations, not causes.
5. **Cost & scenarios.**
   - Type round what-if numbers into the base column, and **say out loud that
     they're hypothetical**.
   - Click an "Assumption" tag to flip it to "Alpha", showing that every input is
     labelled by source.
   - Fill Scenario A and show the net benefit, labelled "Modeled".
6. **Failure mode.** In a terminal, run `python3 demo.py outage 20`. On the
   next check the dashboard goes red and shows "Data unavailable" with no
   figures, then recovers by itself. That covers the D4 test "a broken
   connection shows an explicit error and no data".
7. **Build status.** Close here. It shows what's demonstrable tonight, what
   waits on data, the acceptance tests, the path from D1 to D6 and the
   questions for Alpha.

## Layout

```
api/main.py              FastAPI: /api/status, /api/discovery, /api/view/{id}; no-store on every response
api/supabase_client.py   read-only Supabase client (GET + sign-in only; never returns row values)
api/auth.py              dashboard accounts + sessions in the team's Postgres database
api/users.py             CLI to add, list and disable accounts
api/check_connection.py  CLI: sign in and list visible tables
frontend/src/            React shell, blueprint.jsx, one file per view
frontend/src/theme/      Version 1 design tokens + styles, copied unchanged from ~/Desktop/Dashboard Style & Theme
demo.py                  simulates a dropped connection (local flag file only)
archive/                 an earlier synthetic-data prototype, parked and not used by the app
```
