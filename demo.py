"""Demo control for class: simulate losing the database connection.

    python demo.py outage 20     The API reports "Database connection failed" for
                                 20 seconds. The open dashboard shows its explicit
                                 "data unavailable" state, then recovers by itself.

This touches only a local flag file (.outage) — never Alpha's database, which is
read-only for us. The live-update acceptance test is a change the client makes.
"""
import sys
import time
from pathlib import Path

FLAG = Path(__file__).resolve().parent / ".outage"

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] != "outage":
        sys.exit(__doc__)
    secs = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    FLAG.write_text(str(time.time() + secs))
    print(f"Connection down for {secs} s. Watch the status bar: it turns red on the next check, then recovers.")
