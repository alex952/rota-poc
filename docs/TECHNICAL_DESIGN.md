# Technical Design

## Overview

The system is a small monorepo with:

- `backend/`: NestJS API, scheduling engine, holiday resolution, and PostgreSQL persistence
- `frontend/`: Angular UI for doctor pools, rota generation, calendar display, and replacement flows
- `docker-compose.yml`: local PostgreSQL plus backend and frontend containers

## Runtime Architecture

```text
Angular frontend  <->  NestJS API (/api/v1)  <->  PostgreSQL
                                |
                                +-> Holiday API (date.nager.at)
```

## Backend Design

### Framework choices

- NestJS 11 on Fastify for a lightweight HTTP layer
- TypeORM for entities and migrations
- `class-validator` and `class-transformer` for request validation
- Plain TypeScript services for scheduling and stats logic

### Module boundaries

- `config`: serves runtime config to the frontend
- `holidays`: resolves and caches holiday data by city
- `rota`: generate, read, list, and replace rota assignments
- `scheduling`: pure scheduling rules and statistics
- `database`: TypeORM options and migrations
- `health`: liveness endpoint

### API contract

- `GET /health` returns `{ status: "ok" }`
- `GET /api/v1/config` returns the configured city
- `GET /api/v1/holidays/:year` returns cached or fetched holidays for the configured city
- `POST /api/v1/rota/generate` generates and persists one rota type
- `GET /api/v1/rota/:year/:rotaType` returns a stored rota, optionally filtered by `doctor_id`
- `GET /api/v1/rota/:year` returns all rotas for a year
- `PATCH /api/v1/rota/:year/:rotaType/replace` swaps a single assignment

## Persistence Design

The backend stores four tables:

- `rotas`
- `rota_doctors`
- `rota_assignments`
- `holidays`

Migrations live in `backend/src/database/migrations/` and are run through the TypeORM CLI.

## Scheduling Design

The rota algorithm is intentionally kept outside NestJS decorators and transport concerns.

- Day classification is derived from Sundays plus the holiday cache
- `doctorsPerDay` is computed automatically
- AC and AP are generated independently
- Reduced-hours AC doctors generate linked `refuerzo` assignments
- Statistics are recomputed from persisted assignments for response consistency

See [ALGORITHM.md](./ALGORITHM.md) for the detailed rule set.

## Frontend Integration

The Angular frontend calls the backend through `/api/v1/*` and expects:

- stable snake_case response fields
- separate AC and AP rota payloads
- replace flows for both `primary` and `refuerzo` assignments
- the configured city via `/api/v1/config`

## Local Development

### Backend

```bash
cd backend
npm install
npm run migration:run
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npx ng serve --port 4200 --proxy-config src/proxy.conf.json
```

### Docker

```bash
docker compose up --build
```

## Testing Strategy

- `backend`: Jest unit and e2e tests
- `frontend`: Angular CLI component and service tests
- The backend e2e suite uses `sql.js` and mocked holiday API responses to validate the public HTTP contract
