# Technical Design Document: Doctor Rota Assignment App

**Version:** 1.0
**Date:** 2026-03-12
**Status:** Draft - PoC Scope
**Companion:** [PRD.md](./PRD.md)

---

## 1. Architecture Overview

The system is a **monorepo** containing two services:

```
rota-poc/
├── backend/          # Assignment microservice (Python/FastAPI)
├── frontend/         # Schedule UI (Angular)
├── docker-compose.yml
├── docs/
└── REQUIREMENTS.md
```

```
┌──────────────┐       HTTP/JSON        ┌──────────────────┐       SQL        ┌────────────┐
│   Angular    │ ◄────────────────────► │  FastAPI Service  │ ◄──────────────► │ PostgreSQL │
│   Frontend   │                        │  (Assignment)     │                  │            │
└──────────────┘                        └────────┬─────────┘                  └────────────┘
                                                 │
                                                 │ HTTP
                                                 ▼
                                        ┌──────────────────┐
                                        │ Holiday API       │
                                        │ (External)        │
                                        └──────────────────┘
```

---

## 2. Backend Service

### 2.1 Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | Python | 3.12+ |
| Framework | FastAPI | 0.115+ |
| Validation | Pydantic | 2.x |
| ORM | SQLAlchemy | 2.x |
| Database | PostgreSQL | 16+ |
| Migrations | Alembic | 1.13+ |
| HTTP Client | httpx | 0.27+ |
| Server | Uvicorn | 0.34+ |
| Dependency Mgmt | uv or pip + requirements.txt | latest |

### 2.2 API Design

#### `GET /api/v1/config`

Returns the app-level configuration (city, etc.) for the frontend to display.

**Response (200):**
```json
{
  "city": "Madrid"
}
```

---

#### `POST /api/v1/rota/generate`

Generates a new rota for the given year, rota type, and doctor pool. Uses the app-configured city for holiday resolution. Replaces any existing rota for that year and type.

**Request:**
```json
{
  "year": 2026,
  "rota_type": "AC",
  "pool": [
    {
      "id": "doc-001",
      "name": "Dr. Garcia",
      "department": "Medicina General",
      "hours_reduced_per_day": 2
    },
    {
      "id": "doc-002",
      "name": "Dr. Lopez",
      "department": "Pediatria"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "year": 2026,
  "rota_type": "AC",
  "doctors_per_day": 1,
  "city": "Madrid",
  "generated_at": "2026-01-15T10:30:00Z",
  "schedule": [
    {
      "date": "2026-01-01",
      "day_type": "holiday",
      "shift_start": "09:00",
      "shift_end": "08:00+1",
        "duration_hours": 23,
        "doctors": [
          {
            "doctor_id": "doc-001",
            "doctor_name": "Dr. Garcia"
          }
        ],
        "refuerzos": [
          {
            "doctor_id": "doc-003",
            "doctor_name": "Dr. Martinez",
            "linked_primary_doctor_id": "doc-001",
            "linked_primary_doctor_name": "Dr. Garcia",
            "shift_start": "10:00",
            "shift_end": "22:00",
            "duration_hours": 12
          }
        ]
      }
  ],
  "stats": {
    "doctors": [
      {
        "doctor_id": "doc-001",
        "doctor_name": "Dr. Garcia",
        "total_hours": 1650,
        "target_hours": 1512,
        "hours_vs_target": 138,
        "primary_hours": 1580,
        "refuerzo_hours": 70,
        "monthly_hours": { "1": 140, "2": 130, "3": 138 },
        "shifts_weekday": 60,
        "shifts_saturday": 15,
        "shifts_sunday_holiday": 12
      }
    ]
  }
}
```

**Error cases:**
- `400` — Pool too small, infeasible pool (cannot meet minimum hours), invalid year, missing fields.
- `502` — Holiday API unreachable.

**Key changes from previous version:**
- `rota_type` in request body (AC or AP)
- doctor pool entries may include `hours_reduced_per_day` (AC only behavior)
- `doctors_per_day` auto-computed and returned in response
- `DayAssignment.doctors` is a list (supports multi-doctor days)
- `DayAssignment.refuerzos` exposes linked AC refuerzo assignments
- `DoctorStats` has `monthly_hours` instead of `ac_hours`/`ap_hours`
- AC minimum hours are personalized per doctor when reduced-hours metadata is present

---

#### `GET /api/v1/rota/{year}/{rota_type}`

Retrieves the stored rota for a given year and rota type (AC or AP).

**Query parameters:**
- `doctor_id` (optional) — filter assignments to a single doctor.

**Response (200):** Same shape as the generate response.

**Error cases:**
- `404` — No rota exists for that year/type.

---

#### `GET /api/v1/rota/{year}`

Retrieves all stored rotas for a given year (returns a list containing AC and/or AP rotas).

**Response (200):**
```json
[
  { "year": 2026, "rota_type": "AC", "doctors_per_day": 1, ... },
  { "year": 2026, "rota_type": "AP", "doctors_per_day": 1, ... }
]
```

**Error cases:**
- `404` — No rotas exist for that year.

---

#### `PATCH /api/v1/rota/{year}/{rota_type}/replace`

Replaces a doctor assignment on a specific date within a rota type.

**Request:**
```json
{
  "date": "2026-03-15",
  "old_doctor_id": "doc-001",
  "new_doctor_id": "doc-003"
}
```

**Response (200):** Updated day entry + recalculated stats.

**Error cases:**
- `404` — No rota for that year/type, or no assignment matching date/old_doctor.
- `400` — new_doctor_id not in original pool.

---

#### `GET /api/v1/holidays/{year}`

Utility endpoint to inspect resolved holidays for the configured city (useful for debugging/transparency).

**Response (200):**
```json
{
  "year": 2026,
  "city": "Madrid",
  "holidays": [
    { "date": "2026-01-01", "name": "Ano Nuevo" },
    { "date": "2026-01-06", "name": "Reyes" }
  ]
}
```

---

### 2.3 Database Schema

```sql
-- Stores metadata about a generated rota
CREATE TABLE rotas (
    id              SERIAL PRIMARY KEY,
    year            INTEGER NOT NULL,
    rota_type       VARCHAR(2) NOT NULL,   -- 'AC' or 'AP'
    doctors_per_day INTEGER NOT NULL,       -- algorithm-computed
    city            VARCHAR(100) NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pool            JSONB NOT NULL,         -- original pool snapshot
    UNIQUE(year, rota_type)
);

-- Stores the doctor pool members for a rota
CREATE TABLE rota_doctors (
    id          SERIAL PRIMARY KEY,
    rota_id     INTEGER NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
    doctor_id   VARCHAR(50) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    department  VARCHAR(200) NOT NULL,
    UNIQUE(rota_id, doctor_id)
);

-- Stores each day's assignments (one row per doctor per day)
CREATE TABLE rota_assignments (
    id              SERIAL PRIMARY KEY,
    rota_id         INTEGER NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    day_type        VARCHAR(20) NOT NULL,  -- 'weekday', 'saturday', 'holiday'
    shift_start     TIME NOT NULL,
    shift_end       TIME NOT NULL,
    duration_hours  INTEGER NOT NULL,
    doctor_id       VARCHAR(50) NOT NULL,  -- one row per doctor per day
    UNIQUE(rota_id, date, doctor_id)
);

-- Stores resolved holidays for a year/city (cached)
CREATE TABLE holidays (
    id      SERIAL PRIMARY KEY,
    year    INTEGER NOT NULL,
    city    VARCHAR(100) NOT NULL,
    date    DATE NOT NULL,
    name    VARCHAR(200) NOT NULL,
    UNIQUE(year, city, date)
);
```

**Indexes:**
- `rota_assignments(rota_id, doctor_id)` — for filtering by doctor.
- `holidays(year, city)` — for holiday lookup.

**Key schema changes from previous version:**
- `rotas` table gains `rota_type` (AC/AP) and `doctors_per_day` columns. Unique constraint changes from `(year)` to `(year, rota_type)`.
- `rota_assignments` replaces `ac_doctor_id`/`ap_doctor_id` with a single `doctor_id` column. One row per doctor per day (supports multi-doctor days). Unique constraint changes from `(rota_id, date)` to `(rota_id, date, doctor_id)`.

### 2.4 Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, CORS, lifespan
│   ├── config.py            # Settings (DB URL, holiday API, city — app-level config)
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes_rota.py   # Rota endpoints
│   │   └── routes_holidays.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── db_models.py     # SQLAlchemy ORM models
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── rota.py          # Pydantic request/response schemas
│   ├── services/
│   │   ├── __init__.py
│   │   ├── assignment.py    # Core scheduling algorithm
│   │   ├── holidays.py      # Holiday fetching & caching
│   │   └── stats.py         # Stats calculation
│   └── db/
│       ├── __init__.py
│       ├── session.py       # Engine, sessionmaker
│       └── migrations/      # Alembic
├── tests/
│   ├── test_assignment.py
│   ├── test_holidays.py
│   └── test_api.py
├── alembic.ini
├── pyproject.toml
└── Dockerfile
```

### 2.5 Assignment Algorithm

The rota assignment is a **constraint-satisfaction + optimization** problem. For the PoC, a greedy round-robin approach with balancing is sufficient.

#### Hard Constraints

| ID | Constraint | Detail |
|----|-----------|--------|
| HC-1 | **Separate pools** | AC and AP have separate doctor pools. A doctor belongs to one pool only. |
| HC-2 | **Post-on-call rest day** | A doctor assigned on-call on day D is **unavailable** on day D+1, within the same rota type. Rest days are per-type only (soft constraint for pools < 4). |
| HC-3 | **Minimum hours** | AC doctors must reach >= 1,620h/year (135h/month × 12). AP doctors must reach >= 425h/year. **Hard constraint** — raises error if not met. |
| HC-4 | **Auto-computed doctors_per_day** | The algorithm computes `doctors_per_day = ceil(pool_size × min_hours / total_yearly_hours)`. |

#### Optimization Goals (soft constraints, in priority order)

| Priority | Goal |
|----------|------|
| 1 | **Equity by day-type** — each doctor should have the same (±1) count of weekday, Saturday, and holiday shifts. |
| 2 | **Equity by total hours** — minimize the max-min difference in total hours across doctors. |
| 3 | **Group variation** — prevent the same subset of doctors from always being assigned together (sliding round-robin pointer). |

#### Algorithm: Independent Per-Type Generation

```
Input: rota_type, pool[], days[], holidays[]

1. Classify each day → day_type:
   - If day is a public holiday (including Saturday holidays) → "holiday" (23h)
   - Else if Saturday → "saturday" (18h)
   - Else if Sunday → "holiday" (23h)
   - Else → "weekday" (17h)

2. Compute doctors_per_day:
   total_yearly_hours = sum of all day durations
   min_hours = 1620 if AC, 425 if AP
   doctors_per_day = ceil(len(pool) * min_hours / total_yearly_hours)

3. For each day D in the year (chronological):
   - Build eligible set: all doctors MINUS:
     · Any doctor assigned on day D-1 (rest day rule, if enough alternatives)
     · Any doctor already assigned today (if doctors_per_day > 1)
   - Sort eligible doctors by:
     1. Fewest shifts of this day_type (equity)
     2. Fewest total hours
     3. Round-robin position: (doctor_index - rr_pointer) % N
   - Assign top `doctors_per_day` candidates
   - Advance rr_pointer by 1 (breaks cohort lock-in)
   - Update counters and last_assigned_date

4. Validate (hard):
   - AC: every doctor has >= 1620h/year
   - AP: every doctor has >= 425h/year
   - Raise InfeasiblePoolError if any doctor falls short

5. Return schedule + stats
```

#### Feasibility Check (run before generation)

- Pool must have >= `doctors_per_day + doctors_per_day` doctors (need enough for rest-day rotation)
- `doctors_per_day × total_yearly_hours / pool_size` must >= `min_hours` (safety check)
- If infeasible, return a `400` error with explanation

#### Impact of Separate Pools on Scheduling

Because AC and AP now have separate pools:
- AC and AP rotas are **independent** — no cross-type coupling
- Rest days apply per type only (AC rest days don't affect AP)
- Each rota type is generated with a single call; the UI generates them independently
- The calendar displays both types merged by date

### 2.6 Holiday Resolution

**City configuration:** The city is an **app-level setting** via the `CITY` environment variable (e.g., `CITY=Madrid`). It is used for holiday resolution and exposed via `GET /api/v1/config` for the frontend to display.

**Source:** Public API for Spanish holidays. Recommended option:

- **Option A (recommended):** [date.nager.at](https://date.nager.at/api/v3/publicholidays/{year}/ES) — free, no auth, returns national + regional holidays.
  - Limitation: does not include local (municipal) holidays.
  - For local holidays, supplement with a configurable list in `config.py` or a small static JSON file per city.

- **Option B:** Web scraping from an official Spanish government calendar site. More complete but fragile.

**Approach for PoC:** Use Option A for national/regional holidays + a static local holidays JSON file per city that can be maintained manually.

**Day-type precedence:** Holiday > Saturday > Weekday. A Saturday that is also a public holiday is classified as "holiday" (23h). Sunday is always "holiday" (23h).

**Caching:** Holidays for a given year/city are stored in the `holidays` table after first fetch. Subsequent calls for the same year/city read from the database.

---

## 3. Frontend Service

### 3.1 Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Angular | 19+ |
| Language | TypeScript | 5.x |
| Styling | Angular Material or Tailwind CSS | latest |
| Drag & Drop | Angular CDK DragDrop | 19+ |
| HTTP | Angular HttpClient | built-in |
| Build | Angular CLI / esbuild | latest |

> **Confirmed:** Angular v19+ (the modern, actively maintained framework). The original REQUIREMENTS.md referenced "AngularJS" but this has been clarified to mean Angular latest (see PRD RD-5).

### 3.2 UI Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Madrid  [Year Selector: 2026 ▼]                             [Stats ☰]    │
├────────────────────┬────────────────────────────────────────┬───────────────┤
│   DOCTOR POOL      │         CALENDAR VIEW                  │  STATS PANEL │
│                    │                                        │  (hidden)    │
│  ┌──────────────┐  │  ┌─ January 2026 ──────────────────┐  │              │
│  │ Dr. Garcia   │  │  │ Mon Tue Wed Thu Fri  Sat  Sun   │  │  Dr. Garcia  │
│  │ Med. General │  │  │              1    2    3    4    │  │  AC: 140h    │
│  └──────────────┘  │  │  AC: Garcia  ...               │  │  AP: 432h    │
│  ┌──────────────┐  │  │  AP: Lopez   ...               │  │  Total: 572h │
│  │ Dr. Lopez    │  │  │  5    6    7    8    9   10  11 │  │              │
│  │ Pediatria    │  │  │ ...                             │  │  Dr. Lopez   │
│  └──────────────┘  │  └─────────────────────────────────┘  │  AC: 138h    │
│                    │                                        │  AP: 430h    │
│  [+ Add Doctor]    │  ┌─ February 2026 ─────────────────┐  │  Total: 568h │
│  [Generate Rota]   │  │ ...                             │  │              │
│                    │  └─────────────────────────────────┘  │              │
└────────────────────┴────────────────────────────────────────┴───────────────┘
```

### 3.3 Component Architecture

```
app/
├── app.component.ts              # Root layout, year selector
├── app.config.ts                 # Providers, routes
├── core/
│   ├── services/
│   │   ├── rota.service.ts       # HTTP calls to backend API
│   │   ├── config.service.ts     # Fetches app config (city) from backend
│   │   └── doctor-pool.service.ts # Manages pool state, loads config
│   └── models/
│       ├── doctor.model.ts
│       ├── rota.model.ts
│       └── stats.model.ts
├── features/
│   ├── doctor-pool/
│   │   ├── doctor-pool.component.ts    # Left panel container
│   │   ├── doctor-card.component.ts    # Draggable doctor card
│   │   └── add-doctor-dialog.component.ts
│   ├── calendar/
│   │   ├── calendar.component.ts       # Right panel, month grid
│   │   ├── month-view.component.ts     # Single month grid
│   │   └── day-cell.component.ts       # Single day, drop target
│   └── stats/
│       ├── stats-panel.component.ts    # Slide-out stats panel
│       └── doctor-stats-row.component.ts
├── shared/
│   ├── confirm-dialog.component.ts     # Re-generate confirmation
│   └── replace-doctor-dialog.component.ts  # Multi-doctor replacement picker
└── assets/
    └── doctors.json                    # Static doctor pool config (each doctor has rota_type)
```

### 3.4 Static Doctor Configuration

`frontend/src/assets/doctors.json`:
```json
[
  { "id": "doc-001", "name": "Dr. Garcia", "department": "Medicina General", "rota_type": "AC" },
  { "id": "doc-002", "name": "Dr. Lopez", "department": "Pediatria", "rota_type": "AC" },
  { "id": "doc-011", "name": "Dr. Navarro", "department": "Urgencias", "rota_type": "AP" }
]
```

Each doctor specifies their `rota_type` (AC or AP). The pool panel shows AC/AP tabs to switch between pools.

### 3.5 Key User Flows

**Flow 1 — Page Load:**
1. App loads, reads `doctors.json` into pool panel.
2. Calls `GET /api/v1/config` to get the configured city and displays it in the header.
3. Calls `GET /api/v1/rota/{currentYear}`.
4. If 200 → populate calendar, set button to "Re-generate Rota".
5. If 404 → empty calendar, set button to "Generate Rota".

**Flow 2 — Generate Rota:**
1. User clicks "Generate Rota" (or "Re-generate Rota").
2. If re-generate → show confirmation dialog. On cancel, abort.
3. Collect current pool from left panel.
4. Call `POST /api/v1/rota/generate` with pool + year.
5. On success → update calendar and stats with response data.

**Flow 3 — Drag-and-Drop Replacement:**
1. User drags a doctor card from the pool panel (which has an active AC or AP tab).
2. Drops it on a calendar day cell (which shows current assignments for both types).
3. The rota type is determined by the active pool tab (AC or AP).
4. If the day has multiple doctors for that type, a `ReplaceDoctorDialogComponent` appears — user picks which doctor to replace.
5. Calls `PATCH /api/v1/rota/{year}/{rota_type}/replace` with date, old and new doctor.
6. On success → update that day cell and refresh stats.

---

## 4. Infrastructure & DevOps

### 4.1 Docker Compose

```yaml
# docker-compose.yml (structure)
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: rota
      POSTGRES_USER: rota_user
      POSTGRES_PASSWORD: rota_pass
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://rota_user:rota_pass@db:5432/rota
      HOLIDAY_API_URL: https://date.nager.at/api/v3
      CITY: Madrid  # App-level city config for holiday resolution
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "4200:80"
    environment:
      API_URL: http://localhost:8000
    depends_on:
      - backend

volumes:
  pgdata:
```

### 4.2 Local Development

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
# Requires local PostgreSQL or use docker-compose up db
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
ng serve --port 4200 --proxy-config proxy.conf.json
```

`proxy.conf.json` proxies `/api/*` to `http://localhost:8000` during local dev.

### 4.3 Backend Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

### 4.4 Frontend Dockerfile

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npx ng build --configuration=production

FROM nginx:alpine
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

The `nginx.conf` will proxy `/api` requests to the backend service.

---

## 5. Cross-Cutting Concerns

### 5.1 CORS
The FastAPI service will enable CORS for the frontend origin (`http://localhost:4200` in dev, configurable for production).

### 5.2 Error Handling
- Backend returns structured JSON errors: `{ "detail": "message" }`.
- Frontend shows toast/snackbar notifications for errors.

### 5.3 Validation
- All API inputs validated via Pydantic models.
- Frontend performs basic validation before API calls (non-empty pool, valid year).

### 5.4 Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Backend unit tests | pytest | Assignment algorithm, holiday parsing, stats calculation |
| Backend integration tests | pytest + httpx (TestClient) | API endpoints with test database |
| Frontend unit tests | Jasmine + Karma (Angular CLI default) | Component logic, service mocks |
| Frontend e2e tests | (out of scope for PoC) | — |

### 5.5 Out of Scope (PoC)

- Authentication / Authorization
- HTTPS / TLS
- Rate limiting
- Logging infrastructure (basic stdout logging only)
- CI/CD pipeline
- Production deployment manifests (Kubernetes, etc.)

---

## 6. Implementation Order (Suggested)

| Phase | Deliverable | Dependencies |
|-------|-------------|-------------|
| **1** | Project scaffolding: monorepo structure, Docker Compose, DB migrations | None |
| **2** | Holiday service: fetch + cache Spanish holidays | Phase 1 |
| **3** | Assignment algorithm: core scheduling logic with unit tests | Phase 2 |
| **4** | Backend API: generate, query, replace endpoints | Phase 3 |
| **5** | Frontend scaffolding: Angular project, component structure, routing | Phase 1 |
| **6** | Calendar component: month grid, day cells, data binding | Phase 5 |
| **7** | Doctor pool panel: cards, add doctor, static config loading | Phase 5 |
| **8** | Integration: connect frontend to backend, drag-and-drop replacement | Phase 4 + 6 + 7 |
| **9** | Stats panel: hidden side panel with per-doctor stats | Phase 8 |
| **10** | Polish: error handling, loading states, confirmation dialogs | Phase 8 |

---

## 7. Technical Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| Greedy round-robin over LP/CSP solver | Simpler to implement for PoC; sufficient for equitable distribution with small pools. May need backtracking with very small pools due to rest-day constraint. Can be upgraded to CSP later. |
| Independent per-type generation | With separate pools, AC and AP are fully independent. Each call to `generate_rota` handles one type. No cross-type coupling simplifies the algorithm significantly. |
| Auto-computed doctors_per_day | Derived from `ceil(pool_size × min_hours / total_yearly_hours)`. Ensures minimum hours are always achievable. Not a user-configurable parameter. |
| Separate `rota_assignments` table per day | Enables efficient per-doctor queries and individual day replacement without rewriting the full schedule. |
| Holiday API + static local file | No single free API covers Spanish national + regional + local holidays. Hybrid approach is pragmatic. |
| Holiday precedence over Saturday | Confirmed by stakeholder: a Saturday that is also a holiday uses the 23h holiday shift. Simplifies day-type classification. |
| City as app-level config (env var) | City is set once before running the app, not per-request. Simplifies API and ensures consistency between holiday resolution and UI display. |
| Angular v19+ over AngularJS | AngularJS is EOL. Angular 19 is the modern equivalent with active support, better tooling, and CDK drag-drop built in. Confirmed with stakeholders. |
| Store pool snapshot in `rotas.pool` JSONB | Preserves the original pool used for generation even if doctors are later modified. |
| Alembic for migrations | Standard SQLAlchemy migration tool. Enables schema evolution as PoC grows. |
