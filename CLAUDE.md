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
pytest tests/ -v                # run all 51 backend tests
uvicorn app.main:app --reload --port 8000  # run dev server
alembic upgrade head            # run database migrations
alembic revision --autogenerate -m "description"  # create new migration
```

### Frontend

```bash
cd frontend
npx ng test --watch=false       # run all 83 frontend tests
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
- **Algorithm**: Independent per-type balanced round-robin with auto-computed doctors_per_day, rest-day, sliding round-robin pointer, and equity constraints in `backend/app/services/assignment.py`

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

- Backend: `pytest` — 51 tests (23 algorithm, 7 holidays, 16 API, 5 other)
- Frontend: `vitest` — 83 tests (14 service, 53 component, 15 integration)
- All PRD acceptance criteria have corresponding test cases (see docs/IMPLEMENTATION.md section 4.4)
- Tests should be written BEFORE implementation (ATDD approach)

## Business Rules (Critical)

These rules are enforced by the algorithm and verified by tests:
1. AC and AP have **separate doctor pools** — a doctor belongs to one pool only, rotas generated independently
2. A doctor on call on day D is **off on D+1** within the same rota type (rest day — soft constraint for small pools)
3. Minimum hours: **1,620h/year AC** (135h/month × 12), **425h/year AP** per doctor — **hard constraint** (raises error if not met)
4. `doctors_per_day` is **auto-computed**: `ceil(pool_size × min_hours / total_yearly_hours)`
5. Holiday > Saturday > Weekday for day-type classification
6. Assignments should have maximum group variation and be equitable (sliding round-robin pointer prevents cohort lock-in)

## Documentation

- `docs/PRD.md` — Product requirements with all acceptance criteria
- `docs/TECHNICAL_DESIGN.md` — API contracts, DB schema, algorithm design
- `docs/IMPLEMENTATION.md` — Developer guide, component hierarchy, testing strategy
- `docs/ALGORITHM.md` — Assignment algorithm design, constraints, and trade-offs

## PoC Scope Exclusions

No auth, no multi-city, no undo, no mobile layout, no CI/CD, no production deployment. See docs/PRD.md section 4 for the full list.
