# NestJS Migration Plan

This plan assumes the current Python backend stays available until the NestJS port proves parity through tests.

## Target Stack

Use the latest stable NestJS 11.x release, pinned explicitly in the new backend workspace. At the time of writing, that is `v11.1.11` from the official NestJS release feed.

Recommended NestJS defaults:

- `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`
- `@nestjs/config` for typed environment configuration
- `@nestjs/typeorm` with PostgreSQL
- `class-validator` and `class-transformer` with a global `ValidationPipe`
- Jest with `@nestjs/testing` and Supertest for contract tests

## Architecture Direction

Keep the migration closer to the current behavior than to the current file layout.

- `AppModule` for bootstrap, CORS, global prefix, and health.
- `ConfigModule` for `DATABASE_URL`, `HOLIDAY_API_URL`, and `CITY`.
- `HolidaysModule` for fetch/cache/classification.
- `SchedulingModule` for the pure assignment and stats logic.
- `RotaModule` for generate/read/replace orchestration and response mapping.
- Separate DTOs from entities so the public contract stays explicit.

## ATDD Stages

1. Port the tests first.
2. Make the simplest endpoint pass.
3. Move the pure domain logic.
4. Add persistence and response reconstruction.
5. Finish with replace flows and runtime cutover.

Each stage should end with a test pass before moving on.

## Parallel Workstreams

These can run in parallel once the NestJS workspace exists:

- HTTP contract tests for config, holidays, and rota endpoints.
- Pure scheduling tests for doctors-per-day, rest-day rules, and feasibility.
- Holiday tests for fetch, cache, and regional filtering.
- Persistence tests for schema mapping, uniqueness, and cascade behavior.

## Stage Breakdown

### Stage 0: Scaffold

- Create the NestJS app in a separate workspace or package.
- Add health, config loading, CORS, validation, and test tooling.
- Lock the API prefix to `/api/v1`.

Gate: bootstrap and health test pass.

### Stage 1: Test Migration

- Port the existing Python tests into Jest/Supertest equivalents.
- Keep fixtures small and explicit.
- Mock the holiday API at the boundary.
- Keep SQLite or a lightweight test DB for pure-domain tests, but use PostgreSQL behavior for schema-sensitive cases.

Gate: tests describe the current contract before the feature work lands.

### Stage 2: Config and Holidays

- Implement `GET /api/v1/config`.
- Implement holiday fetch/cache/classification.
- Preserve the holiday precedence rules and city-based regional filtering.

Gate: config and holiday tests pass.

### Stage 3: Scheduling Core

- Port the assignment engine as a pure service.
- Preserve `doctors_per_day`, rest-day handling, AC/AP separation, and `refuerzo` rules.
- Port stats calculation as a pure helper/service.

Gate: algorithm tests pass without hitting HTTP or persistence.

### Stage 4: Persistence and Rota API

- Map the current schema with explicit entities and migrations.
- Persist the rota snapshot, doctors, and assignments.
- Rebuild responses from persisted rows plus the stored pool snapshot.

Gate: generate/read/list tests pass end to end.

### Stage 5: Replace and Cutover

- Implement the replacement endpoint on persisted assignments.
- Validate that stats are recalculated from the updated rows.
- Switch Docker and docs to the NestJS backend once parity is green.

Gate: full API suite passes against the NestJS backend.

## Implementation Notes

- Keep the HTTP layer thin.
- Keep the scheduling logic deterministic and framework-agnostic.
- Use explicit transactions for generate-and-replace flows.
- Do not add new business rules during migration unless a test proves they already exist.
