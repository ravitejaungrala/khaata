# Khaata — Personal Ledger

A full-stack expense & income tracker. React + TypeScript frontend, FastAPI backend, MongoDB storage, with multi-user JWT authentication.

Rebuilt from the original single-file `ledger.html` prototype — same paper-ledger visual design, same monthly/yearly views, donut/bar/line/stacked charts and add-entry flow — now backed by a real API and database with per-user accounts.

## Features

- Email/password signup & login (JWT, bcrypt-hashed passwords)
- Each user has their own private ledger and category list
- Add income and expense entries with category, date and note
- Monthly view: category donut + day-wise stacked bars, each with a chart/table toggle
- Yearly view: income-vs-spend grouped bars, savings-trend line, category split
- Running balance, savings-rate stamp, and summary cards
- Custom categories that persist per user

## Tech stack

| Layer    | Tech                                            |
|----------|-------------------------------------------------|
| Frontend | React 18, TypeScript, Vite                      |
| Backend  | FastAPI, Motor (async MongoDB), python-jose, passlib |
| Database | MongoDB                                          |

## Project structure

```
spend-analyzer/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app + CORS + lifespan
│   │   ├── config.py          # env settings
│   │   ├── database.py        # Mongo connection + indexes
│   │   ├── models.py          # Pydantic schemas
│   │   ├── auth.py            # JWT + password hashing
│   │   └── routers/
│   │       ├── auth.py        # /api/auth  register, login, me
│   │       ├── entries.py     # /api/entries  CRUD
│   │       └── categories.py  # /api/categories
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.tsx            # session + data orchestration
    │   ├── api.ts            # fetch client + token storage
    │   ├── types.ts
    │   ├── lib/ledger.ts     # formatting + aggregation helpers
    │   └── components/       # Ledger, Cards, charts, EntryModal, AuthScreen
    ├── package.json
    └── .env.example
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- A running MongoDB — either local (`mongod`) or a MongoDB Atlas connection string

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then edit values (see below)
uvicorn app.main:app --reload --port 8000
```

Edit `backend/.env`:

- `MONGODB_URI` — e.g. `mongodb://localhost:27017` or your Atlas URI
- `JWT_SECRET` — set a long random string for production
- `CORS_ORIGINS` — the frontend origin (default `http://localhost:5173`)

API docs are available at http://localhost:8000/docs once running.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL defaults to http://localhost:8000
npm run dev
```

Open http://localhost:5173, create an account, and start adding entries.

## API overview

| Method | Endpoint                | Auth | Description                     |
|--------|-------------------------|------|---------------------------------|
| POST   | `/api/auth/register`    | —    | Create account, returns a token |
| POST   | `/api/auth/login`       | —    | Login (form: username=email), returns a token |
| GET    | `/api/auth/me`          | ✔    | Current user profile            |
| GET    | `/api/entries`          | ✔    | List the user's entries         |
| POST   | `/api/entries`          | ✔    | Create an entry                 |
| DELETE | `/api/entries/{id}`     | ✔    | Delete an entry                 |
| GET    | `/api/categories`       | ✔    | List the user's categories      |
| POST   | `/api/categories`       | ✔    | Add a category                  |

Authenticated requests send `Authorization: Bearer <token>`.

## Notes

- The JWT is stored in the browser's `localStorage` and reused across reloads.
- New expense categories typed in the "add entry" form are automatically saved to the user's category list.
- Amounts are treated as INR (₹) for display formatting.
