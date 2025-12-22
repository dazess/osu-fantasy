"""Fetch osu! match info without using the `ossapi` library.

This avoids a TypeError / AssertionError encountered in `ossapi` when
instantiating certain typed response classes. The script uses the
client-credentials grant to obtain an app access token and then calls
`GET /api/v2/matches/{id}` directly.

Usage:
    python matches.py --match 119959585

Requires:
    - `OSU_CLIENT_ID1` and `OSU_CLIENT_SECRET1` in `backend/.env` (or env)
    - `httpx` (pip install httpx)
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import argparse
import json
import sys
import traceback

try:
    import httpx
except Exception as e:
    raise SystemExit("Missing dependency: please install httpx (pip install httpx)") from e

# load envs from backend/.env deterministically
_here = Path(__file__).resolve().parent
load_dotenv(dotenv_path=_here.parent / ".env")

CLIENT_ID = os.getenv("OSU_CLIENT_ID1")
CLIENT_SECRET = os.getenv("OSU_CLIENT_SECRET1")
if not CLIENT_ID or not CLIENT_SECRET:
    raise SystemExit("Error: OSU_CLIENT_ID1 and OSU_CLIENT_SECRET1 environment variables are required for this script. Set them in backend/.env or the environment and try again.")

TOKEN_URL = "https://osu.ppy.sh/oauth/token"
API_BASE = "https://osu.ppy.sh/api/v2"


def get_app_token(client_id: str, client_secret: str) -> str:
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials",
        "scope": "public",
    }
    with httpx.Client(timeout=20.0) as client:
        r = client.post(TOKEN_URL, data=data, headers={"Accept": "application/json"})
    if r.status_code != 200:
        raise RuntimeError(f"Failed to obtain token: {r.status_code} {r.text}")
    payload = r.json()
    token = payload.get("access_token")
    if not token:
        raise RuntimeError(f"No access_token in token response: {payload}")
    return token


def fetch_match(match_id: int, token: str) -> dict:
    url = f"{API_BASE}/matches/{match_id}"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    with httpx.Client(timeout=30.0) as client:
        r = client.get(url, headers=headers)
    if r.status_code == 200:
        return r.json()
    if r.status_code == 401:
        raise PermissionError("Unauthorized: token invalid or expired")
    raise RuntimeError(f"Request failed: {r.status_code} {r.text}")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Fetch an osu! match and print JSON representation (uses client_credentials token)")
    p.add_argument("--match", type=int, required=False, default=int(os.getenv("OSU_MATCH_ID", "119959585")), help="Match id to fetch")
    p.add_argument("--out", type=str, default=None, help="If provided, write pretty JSON to this file instead of stdout")
    args = p.parse_args(argv)

    try:
        token = get_app_token(CLIENT_ID, CLIENT_SECRET)
        match = fetch_match(args.match, token)
        pretty = json.dumps(match, indent=2, ensure_ascii=False)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as f:
                f.write(pretty)
            print(f"Wrote match {args.match} JSON to {args.out}")
        else:
            print(pretty)
    except Exception as e:
        print("Error fetching match:", e, file=sys.stderr)
        traceback.print_exc()
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())