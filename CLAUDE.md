# CLAUDE.md

## Project Overview

Doctor Rota Assignment App — a PoC for automated on-call scheduling for doctors in Spanish hospitals. Monorepo with a Python/FastAPI backend and an Angular 19+ frontend.

## Repository Structure

- `backend/` — Python 3.12 / FastAPI / SQLAlchemy / PostgreSQL
- `frontend/` — Angular 19+ / TypeScript / Angular CDK
- `docs/` — PRD, Technical Design, Implementation Guide
- `docker-compose.yml` — Full stack (db, backend, frontend)

## Quick Commands

### Backend

```bash
cd backend
source .venv/bin/activate       # activate virtualenv
pytest tests/ -v                # run all 31 backend tests
uvicorn app.main:app --reload --port 8000  # run dev server
alembic upgrade head            # run database migrations
alembic revision --autogenerate -m "description"  # create new migration
```

### Frontend

```bash
cd frontend
npx ng test --watch=false       # run all 71 frontend tests
npx ng build                    # production build
npx ng serve --port 4200 --proxy-config src/proxy.conf.json  # dev server
```

### Docker

```bash
docker compose up --build       # full stack
docker compose up db            # just PostgreSQL (for local backend dev)
```

## Architecture

- **Backend API** at `/api/v1`: config, rota CRUD, holidays, health
- **Database**: PostgreSQL with 4 tables — rotas, rota_doctors, rota_assignments, holidays
- **Frontend**: Angular standalone components with signal-based state
- **Algorithm**: Balanced round-robin with rest-day, sparsity, and equity constraints in `backend/app/services/assignment.py`

## Key Configuration

Environment variables (backend):
- `DATABASE_URL` — PostgreSQL connection string
- `HOLIDAY_API_URL` — Spanish holiday API (default: date.nager.at)
- `CITY` — Hospital city (default: Madrid), drives holiday resolution and UI display

## Coding Conventions

### Backend (Python)
- Sync SQLAlchemy (not async) for simplicity
- Pydantic v2 models for all request/response schemas in `app/schemas/`
- SQLAlchemy 2.x `mapped_column` style in `app/models/`
- Business logic in `app/services/`, routes in `app/api/`
- Tests use in-memory SQLite with `StaticPool` (see `tests/conftest.py`)
- Mock external APIs (holiday service) in tests using `unittest.mock.patch`

### Frontend (Angular/TypeScript)
- Angular 19+ standalone components — no NgModules
- Signal-based state management (not RxJS subjects for component state)
- vitest test runner (not Jasmine/Karma) — do NOT use `fail()`, use `throw new Error()`
- `provideHttpClient()` + `provideHttpClientTesting()` for service tests
- Component tests use `TestBed.configureTestingModule()`
- SCSS for styling, inline in components

## Testing

- Backend: `pytest` — 31 tests (13 algorithm, 7 holidays, 11 API)
- Frontend: `vitest` — 71 tests (10 service, 49 component, 12 integration)
- All PRD acceptance criteria have corresponding test cases (see docs/IMPLEMENTATION.md section 4.4)
- Tests should be written BEFORE implementation (ATDD approach)

## Business Rules (Critical)

These rules are enforced by the algorithm and verified by tests:
1. A doctor **cannot** be assigned both AC and AP on the same day (min pool: 2)
2. A doctor on call on day D is **off on D+1** (rest day — soft constraint for pools < 4)
3. Minimum hours: 135h/year AC, 425h/year AP per doctor — **soft constraint** (returns warnings, not errors, when pool is too large to meet minimums)
4. Holiday > Saturday > Weekday for day-type classification
5. Assignments should be as sparse and equitable as possible

## Documentation

- `docs/PRD.md` — Product requirements with all acceptance criteria
- `docs/TECHNICAL_DESIGN.md` — API contracts, DB schema, algorithm design
- `docs/IMPLEMENTATION.md` — Developer guide, component hierarchy, testing strategy
- `docs/ALGORITHM.md` — Assignment algorithm design, constraints, and trade-offs

## PoC Scope Exclusions

No auth, no multi-city, no undo, no mobile layout, no CI/CD, no production deployment. See docs/PRD.md section 4 for the full list.
