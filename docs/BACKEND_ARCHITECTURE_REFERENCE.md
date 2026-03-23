# Backend Architecture Reference

This document summarizes the current NestJS backend now that the Python implementation has been retired.

## System Shape

- `backend/src/main.ts` bootstraps a Fastify-based Nest app, applies `/api/v1` as the global prefix, enables CORS, and registers validation.
- `backend/src/app.module.ts` composes the config, database, holidays, rota, and health modules.
- TypeORM is the persistence layer for PostgreSQL in production and `sql.js` in tests.
- Scheduling and holiday classification remain in plain domain services so the HTTP layer stays thin.

## Request Flow

1. A controller receives the HTTP request and validates input DTOs with the global `ValidationPipe`.
2. The relevant service loads holidays/config and runs the scheduling logic when needed.
3. TypeORM persists `rotas`, `rota_doctors`, `rota_assignments`, and cached `holidays`.
4. `RotaResponseMapper` rebuilds the API response shape, including stats and filtered rota views.

## Modules

- `src/config/` exposes application config such as `CITY`.
- `src/database/` owns TypeORM setup and migrations.
- `src/holidays/` fetches Spanish holidays, filters them by city/region, and caches them.
- `src/scheduling/` contains the rota algorithm and stats calculation.
- `src/rota/` owns generation, retrieval, replacement, entities, and response mapping.
- `src/health/` provides the `/health` liveness endpoint.

## API Surface

- `GET /health`
- `GET /api/v1/config`
- `GET /api/v1/holidays/:year`
- `POST /api/v1/rota/generate`
- `GET /api/v1/rota/:year/:rotaType`
- `GET /api/v1/rota/:year`
- `PATCH /api/v1/rota/:year/:rotaType/replace`

## Data Model

- `rotas`: one persisted rota per `(year, rota_type)` plus the original pool snapshot.
- `rota_doctors`: normalized pool members for a rota, including `hours_reduced_per_day`.
- `rota_assignments`: one row per assignment and assignment kind (`primary` or `refuerzo`).
- `holidays`: cached holiday rows keyed by `(year, city, date)`.

Important constraints:

- `rotas(year, rota_type)` is unique.
- `rota_doctors(rota_id, doctor_id)` is unique.
- `rota_assignments(rota_id, date, doctor_id, assignment_kind)` is unique.
- Child rows cascade on rota deletion.

## Testing Shape

- `backend/test/unit/assignment.spec.ts` covers rota generation rules and invariants.
- `backend/test/unit/holidays.spec.ts` covers holiday filtering and caching behavior.
- `backend/test/e2e/app.e2e-spec.ts` covers the HTTP contract against an in-memory `sql.js` database.

## Operational Notes

- Production and Docker use PostgreSQL migrations via `npm run migration:run` or `npm run migration:run:dist`.
- The API response preserves overnight shift formatting with `+1`, while PostgreSQL stores only valid `TIME` values.
- The backend does not currently expose Swagger; the stable contract is documented in code and tests.
