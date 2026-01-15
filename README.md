
## Quick start (Windows PowerShell)

### Backend

1. Create + activate a virtual environment

   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

2. Install dependencies

   pip install -r backend/requirements.txt

3. Copy the `.env` example and set a secret

   copy backend\.env.example backend\.env
4. Run the server

   cd backend
   uvicorn app.main:app --reload --port 8000


### Frontend

1. Install dependencies

   cd frontend
   npm install

2. Start dev server

   npm run dev


Initial crawl: python [crawl_owc_2025.py](http://_vscodecontentref_/0) --recreate (sets rank-based costs)

