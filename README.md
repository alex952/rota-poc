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

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
# Start PostgreSQL (or use: docker compose up db)
alembic upgrade head
uvicorn app.main:app --reload --port 8000
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

**Backend (31 tests):**
```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

**Frontend (71 tests):**
```bash
cd frontend
npx ng test --watch=false
```

## Project Structure

```
rota-poc/
├── backend/           # Python/FastAPI assignment microservice
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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic |
| Frontend | Angular 19+, TypeScript, Angular CDK (drag-and-drop) |
| Database | PostgreSQL 16 |
| Testing | pytest (backend), vitest (frontend) |
| Infrastructure | Docker Compose, Nginx |
