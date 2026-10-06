# Time Keeping System

Web-based time keeping system: React (Vite) frontend, Node.js/Express REST API, SQLite database, JWT auth.

## Features
- Employee & admin roles (JWT login)
- Clock in / clock out with live clock and status
- Daily time log with total hours
- Admin: manage employees (add, activate/deactivate), view all records
- Reports: total hours, days present, average hours/day, hours per day chart

## Structure
- `backend/` - Express API (`src/app.js`), SQLite via better-sqlite3 (`src/db.js`), tests in `test/`
- `frontend/` - React app

## Setup
```bash
cd backend && npm install && cp .env.example .env   # set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm start                                           # API on :4000 (seeds the admin on first run)

cd ../frontend && npm install
npm run dev                                         # dev server on :5173, proxies /api
```
Production: `cd frontend && npm run build`; the backend then serves `frontend/dist` itself at `http://localhost:4000`.

Tests: `cd backend && npm test`

## API
All endpoints except login require a JWT sent as a ****** in the `Authorization` header.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | `{email, password}` |
| GET | `/api/auth/me` | |
| GET | `/api/time/status` | |
| POST | `/api/time/clock-in`, `/api/time/clock-out` | |
| GET | `/api/time/logs?from=&to=` | own logs (YYYY-MM-DD, UTC dates) |
| GET/POST | `/api/employees` | admin |
| PUT | `/api/employees/:id` | admin |
| GET | `/api/admin/logs?from=&to=&userId=` | admin |
| GET | `/api/reports/summary?from=&to=` | admin |

Notes: dates are stored/grouped in UTC. Change the seeded admin password after first login and always set a strong `JWT_SECRET`.
