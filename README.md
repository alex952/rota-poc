# Doctor Rota Assignment App

A full-stack application for automated on-call duty scheduling for doctors in Spanish hospitals. The system generates yearly rota assignments ensuring fairness, minimum hour compliance, and proper rest-day enforcement.

**Status:** Proof of Concept

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:4200
- Backend API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

### Local Development

**Prerequisites:** Python 3.12+, Node 22+, PostgreSQL 16+

**Backend (NestJS):**
```bash
cd backend-nest
npm install
# Start PostgreSQL (or use: docker compose up db)
npm run migration:run
npm run start:dev
```

**Frontend:**
```bash
cd frontend
npm install
npx ng serve --port 4200 --proxy-config src/proxy.conf.json
```

The proxy config routes `/api/*` requests to the backend at `localhost:8000`.

## Configuration

The hospital city is configured via the `CITY` environment variable on the backend (defaults to `Madrid`). This controls holiday resolution and is displayed in the UI.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://rota_user:rota_pass@localhost:5432/rota` | PostgreSQL connection string |
| `HOLIDAY_API_URL` | `https://date.nager.at/api/v3` | Spanish holiday API |
| `CITY` | `Madrid` | Hospital city for holiday resolution |

## Running Tests

**Backend (NestJS):**
```bash
cd backend-nest
npm test
```

**Frontend (71 tests):**
```bash
cd frontend
npx ng test --watch=false
```

## Project Structure

```
rota-poc/
├── backend/           # Original Python/FastAPI backend reference
├── backend-nest/      # NestJS backend migration target
├── frontend/          # Angular 19+ schedule UI
├── docs/              # Product and technical documentation
│   ├── PRD.md         # Product requirements & acceptance criteria
│   ├── TECHNICAL_DESIGN.md  # Architecture & API design
│   └── IMPLEMENTATION.md    # Implementation details & developer guide
├── docker-compose.yml
└── REQUIREMENTS.md    # Original product definition
```

## Documentation

| Document | Description |
|----------|-------------|
| [REQUIREMENTS.md](REQUIREMENTS.md) | Original product definition |
| [docs/PRD.md](docs/PRD.md) | Product requirements with acceptance criteria for all features |
| [docs/TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md) | Architecture, API contracts, database schema, algorithm design |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | Implementation details, developer guide, testing strategy |
| [docs/ALGORITHM.md](docs/ALGORITHM.md) | Assignment algorithm design, constraints, and trade-offs |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11, TypeScript, TypeORM |
| Frontend | Angular 19+, TypeScript, Angular CDK (drag-and-drop) |
| Database | PostgreSQL 16 |
| Testing | pytest (backend), vitest (frontend) |
| Infrastructure | Docker Compose, Nginx |
