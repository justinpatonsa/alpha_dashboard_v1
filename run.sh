#!/bin/sh
# One command for the class demo: build the UI, serve UI + API on one port.
#   ./run.sh            then open http://localhost:8000
set -e
cd "$(dirname "$0")"
python3 -c "import fastapi, uvicorn, psycopg, bcrypt" 2>/dev/null || python3 -m pip install -r requirements.txt
[ -d frontend/node_modules ] || (cd frontend && npm install --no-audit --no-fund)
(cd frontend && npx vite build --logLevel warn)
echo "Alpha Retention Dashboard → http://localhost:8000"
exec python3 -m uvicorn api.main:app --port 8000
