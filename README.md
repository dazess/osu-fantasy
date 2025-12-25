# osu!fantasy — Minimal Starter

This repository is a minimal full-stack scaffold for prototyping a small app:

- Backend: FastAPI + SQLite + JWT-based auth
- Frontend: Vite + React (JS)

---

## Quick start (Windows PowerShell)

### Backend

1. Create + activate a virtual environment

   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

2. Install dependencies

   pip install -r backend/requirements.txt

3. Copy the `.env` example and set a secret

   copy backend\.env.example backend\.env
   # Edit backend\.env and replace SECRET_KEY with a secure random value
   # You can generate a key in Python: python -c "import secrets; print(secrets.token_urlsafe(32))"

4. Run the server

   cd backend
   uvicorn app.main:app --reload --port 8000

The API will be available at http://localhost:8000 and exposes endpoints:
- POST /api/register  (body: username, email, password)
- POST /api/login     (body: username, password) -> returns access_token
- GET /api/me         (Authorization: Bearer <token>) -> current user

### Frontend

1. Install dependencies

   cd frontend
   npm install

2. Start dev server

   npm run dev

Vite proxies `/api` requests to `http://localhost:8000` during development, so the frontend can call `/api/login`, `/api/register`, etc.

---

## Notes & next steps

- This is intentionally minimal. For production, add: HTTPS, secure cookies, refresh tokens, CSRF protection, rate limiting, input validation, stronger password rules, and tests.
- To test the flow: register a user, then login to obtain a token and call `/api/me`.

Workflow sorry no doc yet:
Initial crawl: python [crawl_owc_2025.py](http://_vscodecontentref_/0) --recreate (sets rank-based costs)


Do these per week:
Mark playing: python update_playing_status.py (marks active countries)
Calculate p_scores: python calculate_pscores.py --matches 119719487 ...
Update costs: python update_costs_by_pscore.py (adjusts costs by performance)