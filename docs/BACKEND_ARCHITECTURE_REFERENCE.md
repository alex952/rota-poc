# Backend Architecture Reference

This document captures the current Python backend as a migration reference for a NestJS rewrite.

## System Shape

The backend is a thin FastAPI service over a small domain core.

- `backend/app/main.py` wires CORS, mounts the API routers under `/api/v1`, and exposes `/health`.
- The backend is synchronous at the DB layer, using SQLAlchemy 2.x with one session per request.
- Business logic is kept mostly outside the HTTP layer in `backend/app/services/`.

## Request Flow

1. The route handler validates the request with Pydantic models from `backend/app/schemas/rota.py`.
2. The handler calls service-layer logic for holidays, scheduling, or stats.
3. Persistence is handled through SQLAlchemy models in `backend/app/models/db_models.py`.
4. Responses are rebuilt explicitly from stored rows plus the persisted pool snapshot.

## Route Boundaries

- `GET /api/v1/config` returns the configured city.
- `GET /api/v1/holidays/{year}` resolves holidays for the configured city.
- `POST /api/v1/rota/generate` generates and persists a rota.
- `GET /api/v1/rota/{year}/{rota_type}` reads a stored rota, optionally filtered by `doctor_id`.
- `GET /api/v1/rota/{year}` returns all rotas for that year.
- `PATCH /api/v1/rota/{year}/{rota_type}/replace` swaps one assignment and recalculates stats.
- `GET /health` is a simple liveness check.

## Domain Modules

- `backend/app/services/assignment.py` contains the core scheduling algorithm, feasibility checks, rest-day logic, and `refuerzo` generation.
- `backend/app/services/holidays.py` fetches external holidays, caches them in the DB, and classifies each calendar day.
- `backend/app/services/stats.py` calculates total hours, monthly totals, and shift counts per doctor.

## Data Model

- `rotas` stores one generated rota per `(year, rota_type)` plus the original `pool` JSON snapshot.
- `rota_doctors` stores the normalized doctor pool for a rota, including `hours_reduced_per_day`.
- `rota_assignments` stores one row per doctor per date and assignment kind.
- `holidays` caches resolved holidays by `(year, city, date)`.

Important constraints:

- `rotas(year, rota_type)` is unique.
- `rota_doctors(rota_id, doctor_id)` is unique.
- `rota_assignments(rota_id, date, doctor_id, assignment_kind)` is unique.
- Both child tables cascade on rota deletion.

## Testing Shape

- `backend/tests/test_assignment.py` covers the pure scheduling algorithm.
- `backend/tests/test_holidays.py` covers holiday fetch, cache, and classification behavior.
- `backend/tests/test_api.py` covers the HTTP contract end to end.
- `backend/tests/conftest.py` uses in-memory SQLite plus dependency overrides.

## Behavior To Preserve

- AC and AP are separate pools and are generated independently.
- `doctors_per_day` is computed, not user-supplied.
- Holiday classification wins over Saturday classification.
- Replace updates only the targeted assignment row and then rebuilds the response.
- The response shape is contract-driven and should remain stable during migration.

