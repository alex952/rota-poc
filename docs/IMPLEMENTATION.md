# Implementation Guide

## Repository Layout

```text
rota-poc/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── database/
│   │   ├── health/
│   │   ├── holidays/
│   │   ├── rota/
│   │   └── scheduling/
│   └── test/
├── frontend/
└── docs/
```

## Backend Workflow

### Install and run

```bash
cd backend
npm install
npm run migration:run
npm run start:dev
```

### Run tests

```bash
cd backend
npm test
npm run build
```

### Production start

The Docker image builds TypeScript, runs `npm run migration:run:dist`, and starts `node dist/src/main.js`.

## Backend Conventions

- Controllers stay small and delegate to services
- DTOs define request contracts
- Entities represent persisted rows only
- Response-shape adaptation belongs in `RotaResponseMapper`
- Scheduling rules live in `src/scheduling/`
- Holiday fetch and cache behavior lives in `src/holidays/`

## Database and Migrations

- TypeORM configuration lives in `src/database/typeorm.config.ts`
- CLI datasource lives in `src/database/data-source.ts`
- PostgreSQL is the default runtime database
- `sql.js` is used only for test isolation

Migration commands:

```bash
cd backend
npm run migration:show
npm run migration:run
npm run migration:revert
```

## Testing Notes

- Unit tests cover holiday logic and scheduling invariants
- E2E tests cover the public HTTP contract
- The test app uses the same Nest bootstrap shape as production, with `sql.js` in place of PostgreSQL
- External holiday API calls are mocked in tests

## Frontend Expectations

The frontend expects:

- `/api/v1/config` for the city banner
- `/api/v1/rota/:year` to preload AC and AP schedules together
- `/api/v1/rota/generate` to return a full persisted rota response
- `/api/v1/rota/:year/:rotaType/replace` to return the refreshed rota after replacement

## Current Operational Constraints

- No authentication
- Single configured city per backend instance
- No undo support
- No Swagger/OpenAPI UI yet
- Docker Compose is the primary local full-stack workflow
