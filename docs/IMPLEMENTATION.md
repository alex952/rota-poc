# Implementation Guide

**Companion documents:** [PRD.md](./PRD.md) | [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md)

---

## 1. Repository Layout

```
rota-poc/
├── backend/
│   ├── app/
│   │   ├── api/                  # FastAPI route handlers
│   │   │   ├── routes_config.py  # GET /api/v1/config
│   │   │   ├── routes_holidays.py# GET /api/v1/holidays/{year}
│   │   │   └── routes_rota.py    # POST generate, GET rota, PATCH replace
│   │   ├── db/
│   │   │   └── session.py        # SQLAlchemy engine, sessionmaker, get_db
│   │   ├── models/
│   │   │   └── db_models.py      # ORM models (Rota, RotaDoctor, RotaAssignment, Holiday)
│   │   ├── schemas/
│   │   │   └── rota.py           # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── assignment.py     # Core scheduling algorithm
│   │   │   ├── holidays.py       # Holiday fetching, caching, day classification
│   │   │   └── stats.py          # Per-doctor statistics calculation
│   │   ├── config.py             # Pydantic Settings (env vars)
│   │   └── main.py               # FastAPI app, CORS, router mounting
│   ├── tests/
│   │   ├── conftest.py           # Fixtures: in-memory SQLite DB, test client
│   │   ├── test_api.py           # API endpoint integration tests
│   │   ├── test_assignment.py    # Algorithm unit tests
│   │   └── test_holidays.py      # Holiday service unit tests
│   ├── alembic/                  # Database migrations
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/app/
│   │   ├── core/
│   │   │   ├── models/           # TypeScript interfaces
│   │   │   └── services/         # ConfigService, RotaService, DoctorPoolService, NotificationService
│   │   ├── features/
│   │   │   ├── calendar/         # CalendarComponent, MonthViewComponent, DayCellComponent
│   │   │   ├── doctor-pool/      # DoctorPoolComponent, DoctorCardComponent, AddDoctorDialogComponent
│   │   │   └── stats/            # StatsPanelComponent, DoctorStatsRowComponent
│   │   ├── shared/               # ConfirmDialogComponent, ServiceTypeDialogComponent, NotificationComponent
│   │   ├── app.ts                # Root component (orchestration)
│   │   └── app.html              # Root template (three-panel layout)
│   ├── src/assets/doctors.json   # Static doctor pool config
│   ├── src/proxy.conf.json       # Dev proxy to backend
│   ├── nginx.conf                # Production reverse proxy
│   ├── angular.json
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

---

## 2. Backend

### 2.1 Configuration (`app/config.py`)

Uses `pydantic-settings` to load from environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://rota_user:rota_pass@localhost:5432/rota` | PostgreSQL connection |
| `HOLIDAY_API_URL` | `https://date.nager.at/api/v3` | External holiday API base URL |
| `CITY` | `Madrid` | Hospital city — drives holiday resolution and is shown in the UI |

The `Settings` class is instantiated as a module-level singleton via `get_settings()`.

### 2.2 Database

**Engine:** Synchronous SQLAlchemy 2.x with `mapped_column` style. The `get_db` dependency yields a session per request.

**Tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `rotas` | One row per generated rota year | `year` (unique), `city`, `generated_at`, `pool` (JSONB snapshot) |
| `rota_doctors` | Doctor pool members for a rota | FK to `rotas`, `doctor_id`, `name`, `department` |
| `rota_assignments` | One row per day per rota | FK to `rotas`, `date` (unique per rota), `day_type`, `ac_doctor_id`, `ap_doctor_id` |
| `holidays` | Cached holiday data per year/city | `year`, `city`, `date`, `name` |

**Indexes:** `rota_assignments(rota_id, ac_doctor_id)`, `rota_assignments(rota_id, ap_doctor_id)`, `holidays(year, city)`.

**Migrations:** Managed via Alembic. The initial migration (`001_initial_schema.py`) creates all four tables. On Docker startup, `alembic upgrade head` runs automatically before the app starts.

### 2.3 API Endpoints

All endpoints are under `/api/v1`.

#### `GET /config`
Returns the configured city. The frontend calls this on page load to display the city name.

#### `POST /rota/generate`
Accepts `{ year, pool[] }`. Orchestrates:
1. Fetch/cache holidays for the configured city
2. Classify all days in the year (weekday/saturday/holiday)
3. Run the assignment algorithm
4. Delete any existing rota for that year
5. Persist the new rota (rotas, rota_doctors, rota_assignments)
6. Calculate and return stats

Returns 201 with full `RotaResponse`. The response includes a `warnings` list for soft-constraint violations (e.g. pool too large for minimum hour targets). Returns 400 only if the pool has fewer than 2 doctors (hard constraint). Returns 502 if the holiday API is unreachable.

#### `GET /rota/{year}`
Retrieves a stored rota. Optional `?doctor_id=X` query parameter filters to assignments involving that doctor (in either AC or AP slot). Returns 404 if no rota exists.

#### `PATCH /rota/{year}/replace`
Accepts `{ date, service_type, old_doctor_id, new_doctor_id }`. Swaps the doctor for a single day/service-type assignment. Recalculates and returns updated stats. Returns 404 if no matching assignment is found.

#### `GET /holidays/{year}`
Returns the cached (or freshly fetched) holidays for the configured city. Useful for debugging.

#### `GET /health`
Returns `{ status: "ok" }`.

### 2.4 Holiday Service (`app/services/holidays.py`)

**Fetching:** Calls `https://date.nager.at/api/v3/PublicHolidays/{year}/ES` via `httpx`. Returns national and regional Spanish holidays. Local (municipal) holidays are not included by this API — they can be supplemented with a static file if needed.

**Caching:** After the first fetch for a year/city, holidays are stored in the `holidays` table. Subsequent requests read from the database.

**Day classification:**

| Condition | Day Type | Duration | Shift |
|-----------|----------|----------|-------|
| Sunday or in holiday set (including Saturday holidays) | `holiday` | 23h | 09:00 → 08:00+1 |
| Saturday (not a holiday) | `saturday` | 18h | 15:00 → 09:00+1 |
| Everything else | `weekday` | 17h | 15:00 → 08:00+1 |

**Precedence:** Holiday > Saturday > Weekday. A Saturday that falls on a public holiday is classified as `holiday` (23h).

### 2.5 Assignment Algorithm (`app/services/assignment.py`)

This is the core of the system. It generates a full-year on-call schedule for both Atencion Continuada (AC) and Atencion Primaria (AP).

#### Hard Constraints

| ID | Rule |
|----|------|
| HC-1 | A doctor cannot be assigned both AC and AP on the same day |
| HC-2 | Post-on-call rest day: a doctor assigned on day D is unavailable on D+1 (soft when pool < 4) |
| HC-3 | Minimum hours: each doctor should reach >= 135h AC and >= 425h AP (soft — warns if not met) |
| HC-4 | Exactly one doctor per service type per day |

#### Optimization Goals (priority order)

1. **Day-type equity:** Each doctor gets roughly the same count (+-1) of weekday, Saturday, and holiday shifts
2. **Hour equity:** Minimize the max-min total hour difference across doctors
3. **Sparsity:** Maximize gaps between consecutive on-call assignments

#### Algorithm: Single-Pass Balanced Round-Robin

The algorithm assigns both AC and AP for each day in a single chronological pass:

```
For each day D in the year:
  1. Build eligible set for AC:
     - Exclude doctors assigned on D-1 (rest day, if enough alternatives exist)
  2. Sort eligible by: (fewest shifts of this day_type, fewest AC hours, largest gap)
  3. Assign top candidate to AC

  4. Build eligible set for AP:
     - Exclude the AC doctor for today (HC-1)
     - Exclude doctors assigned on D-1 (rest day, if enough alternatives exist)
  5. Sort eligible by: (fewest shifts of this day_type, fewest AP hours, largest gap)
  6. Assign top candidate to AP

  7. Update tracking: hours, day-type counts, last_assigned_date for both doctors
```

#### Feasibility Check & Warnings

Before generating, the algorithm validates the pool size:
- Must have >= 2 doctors (HC-1 requires different doctors for AC and AP) — **hard error** (`InfeasiblePoolError`)
- If total yearly hours per service / pool size falls below minimum hours (135 for AC, 425 for AP), a **warning** is returned instead of an error. The schedule is still generated.

After generation, actual per-doctor hours are checked against minimums. Any shortfalls are added as additional warnings. Warnings are returned in the `RotaSchedule.warnings` list and propagated through to the API response's `warnings` field.

#### Rest-Day Softness

The rest-day constraint (HC-2) is enforced as a **soft constraint** when the pool is too small. With 2-3 doctors, strict rest-day enforcement may create dead ends. The algorithm falls back to allowing unrested doctors when fewer than 2 rested doctors are available for a slot.

#### Key Implementation Detail: AC/AP Coupling

Because the rest-day rule applies **across both service types**, assigning a doctor AC on Monday blocks them from both AC and AP on Tuesday. The single-pass approach (assigning AC then AP per day) handles this naturally — the global `last_assigned_date` dictionary tracks the most recent assignment regardless of service type.

### 2.6 Stats Calculation (`app/services/stats.py`)

Given a schedule (list of day assignments) and the doctor pool, calculates per-doctor:
- Total on-call hours
- Hours split by service type (AC, AP)
- Shift counts by day type (weekday, Saturday, Sunday/holiday)

---

## 3. Frontend

### 3.1 Architecture

Angular 19+ standalone components with signal-based state management. No NgModules — all components use the `imports` array in their `@Component` decorator.

### 3.2 Services

| Service | Responsibility |
|---------|---------------|
| `ConfigService` | Fetches `GET /api/v1/config`, caches with `shareReplay(1)` |
| `RotaService` | All rota CRUD operations (generate, get, replace, filter by doctor) |
| `DoctorPoolService` | Manages doctor pool state via `BehaviorSubject`, loads from `doctors.json` |
| `NotificationService` | Toast notification queue with auto-dismiss (5s for normal, 10s for warnings) |

### 3.3 Component Hierarchy

```
AppComponent (root orchestrator)
├── Header: city name, "Doctor Rota" title, stats toggle button
├── DoctorPoolComponent (left panel, ~280px fixed)
│   ├── DoctorCardComponent[] (cdkDrag, displays name + department)
│   ├── AddDoctorDialogComponent (reactive form, toggle visibility)
│   └── Buttons: "+ Add Doctor", "Generate Rota" / "Re-generate Rota"
├── CalendarComponent (center, fills right panel)
│   ├── Header bar: month nav (‹/›), month label (click → today), doctor filter pill, year input
│   ├── MonthViewComponent (single month at a time)
│   │   └── DayCellComponent[] (~30 per month)
│   │       └── Day number, AC doctor (clickable), AP doctor (clickable), cdkDropList
│   └── Empty state (shown when no rota exists for selected year)
├── StatsPanelComponent (right, slide-out, hidden by default)
│   └── DoctorStatsRowComponent[] (one per doctor)
├── ConfirmDialogComponent (modal overlay for re-generation)
├── ServiceTypeDialogComponent (AC/AP picker after drag-drop)
└── NotificationComponent (toast stack, top-right corner — supports error/success/info/warning)
```

### 3.4 User Flows

**Page Load:**
1. `ConfigService.getConfig()` → display city in header
2. `DoctorPoolService.loadDoctors()` → populate left panel from `doctors.json`
3. `RotaService.getRota(currentYear)` → if 200: populate calendar + set button to "Re-generate"; if 404: empty state + "Generate Rota"

**Generate Rota:**
1. User clicks "Generate Rota" (or "Re-generate Rota" with confirm dialog)
2. Loading overlay shown on calendar
3. `RotaService.generateRota(year, pool)` → update calendar, stats
4. If response contains warnings → show amber warning notification with all warnings
5. Otherwise → show green success notification
6. On error → show error notification with API detail

**Drag-and-Drop Replacement:**
1. User drags `DoctorCardComponent` (which has `cdkDragData` bound to the doctor object)
2. Drops onto a `DayCellComponent` (which has `cdkDropList`)
3. `ServiceTypeDialogComponent` appears — user picks AC or AP
4. `RotaService.replaceDoctor()` → update day cell + recalculate stats

**Filter by Doctor:**
1. User clicks a doctor name inside a `DayCellComponent` (AC or AP label)
2. `CalendarComponent` sets `filteredDoctor` signal → `currentAssignments` computed filters to only days where that doctor is assigned
3. A filter pill appears in the calendar header bar showing the doctor's name with an ✕ button
4. Click the ✕ or click the same doctor again to clear the filter

**Month Navigation:**
1. ‹/› arrows move to previous/next month (disabled at Jan/Dec boundaries)
2. Clicking the month label (e.g. "March 2026") jumps to the current calendar month
3. Month navigation and label click are disabled when no rota exists

**Year Change:**
1. User changes year in `CalendarComponent` year input
2. Emits `yearChange` event → `AppComponent` fetches rota for new year
3. The calendar header bar always remains visible — the empty state is shown inside the calendar body, so the year input is always accessible

### 3.5 Styling

- Day cells are color-coded by day type: neutral for weekday, amber for Saturday, red-tint for holiday
- Doctor names in day cells are clickable (underline on hover) for filtering
- Filter pill in calendar header: indigo background, rounded, with circular ✕ button
- Calendar grid: 7 columns (Mon–Sun), proper offset for first day of month
- Stats panel slides in from the right with CSS `transform: translateX` transition
- Loading overlay with CSS spinner on the calendar during async operations
- Notifications stack in the top-right corner with slide-in animation (error=red, success=green, info=blue, warning=amber)
- Warning notifications auto-dismiss after 10s (2× normal duration) and support multi-line text
- Confirm dialog uses modal overlay with darkened backdrop

### 3.6 Static Configuration

`src/assets/doctors.json` contains the pre-populated doctor pool:
```json
[
  { "id": "doc-001", "name": "Dr. Garcia", "department": "Medicina General" },
  { "id": "doc-002", "name": "Dr. Lopez", "department": "Pediatria" },
  { "id": "doc-003", "name": "Dr. Martinez", "department": "Cardiologia" }
]
```

Users can add more doctors via the UI. The pool is sent to the backend on rota generation.

---

## 4. Testing

### 4.1 Strategy

| Layer | Framework | Test Type | Count |
|-------|-----------|-----------|-------|
| Backend algorithm | pytest | Unit | 13 |
| Backend holiday service | pytest | Unit (with mocked HTTP) | 7 |
| Backend API | pytest + TestClient | Integration | 11 |
| Frontend services | vitest + HttpTestingController | Unit | 10 |
| Frontend components | vitest + TestBed | Component | 49 |
| Frontend app | vitest + TestBed | Integration | 12 |
| **Total** | | | **102** |

### 4.2 Backend Test Setup (`tests/conftest.py`)

Tests use an **in-memory SQLite** database with `StaticPool` to ensure all connections share the same database instance. Key fixtures:

- `db_session`: Creates all tables, yields a session, rolls back after each test
- `client`: FastAPI `TestClient` with the DB dependency overridden to use the test session
- `sample_pool`: Five sample doctors for algorithm tests

The holiday API is mocked using `unittest.mock.patch` on `httpx.Client.get` in tests that involve holiday fetching.

### 4.3 Frontend Test Setup

Angular's built-in vitest runner (Angular 19+ default). Tests use:
- `TestBed.configureTestingModule()` with `provideHttpClient()` + `provideHttpClientTesting()`
- `HttpTestingController` to mock backend responses
- Service mocks via `jasmine.createSpyObj` or manual stub classes

### 4.4 Acceptance Criteria Traceability

Every PRD acceptance criterion maps to one or more tests:

| PRD Section | Criteria | Test File(s) |
|-------------|----------|-------------|
| 3.1 Rota Generation | AC-3.1.1 to AC-3.1.12 | `test_assignment.py`, `test_api.py` |
| 3.2 Persistence | AC-3.2.1 to AC-3.2.4 | `test_api.py` |
| 3.3 Replacement | AC-3.3.1 to AC-3.3.2 | `test_api.py` |
| 3.4 Holidays | AC-3.4.1 to AC-3.4.4 | `test_holidays.py` |
| 3.5 Statistics | AC-3.5.1 to AC-3.5.2 | `test_api.py`, `stats-panel.component.spec.ts` |
| 3.6 Calendar UI | AC-3.6.1 to AC-3.6.7 | `calendar.component.spec.ts`, `app.spec.ts` |
| 3.7 Doctor Pool | AC-3.7.1 to AC-3.7.5 | `doctor-pool.component.spec.ts`, `doctor-card.component.spec.ts` |
| 3.8 Stats Panel | AC-3.8.1 to AC-3.8.3 | `stats-panel.component.spec.ts` |

---

## 5. Infrastructure

### 5.1 Docker Compose

Three services:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `db` | postgres:16-alpine | 5432 | PostgreSQL database |
| `backend` | Custom (Python 3.12-slim) | 8000 | FastAPI + Uvicorn |
| `frontend` | Custom (Nginx alpine) | 4200 | Serves Angular build, proxies `/api` |

The `pgdata` volume persists database data across container restarts.

### 5.2 Backend Dockerfile

Single-stage build: installs Python dependencies, copies app code, runs `alembic upgrade head` then `uvicorn` on startup.

### 5.3 Frontend Dockerfile

Multi-stage build:
1. **Build stage** (node:22-alpine): `npm ci` → `ng build --configuration=production`
2. **Runtime stage** (nginx:alpine): Copies built assets, uses custom `nginx.conf`

### 5.4 Nginx Configuration

The frontend nginx serves static files and proxies API requests:
- `/api/*` → `http://backend:8000` (Docker service name resolution)
- All other paths → `index.html` (SPA fallback)

### 5.5 Local Development

For local development without Docker, start PostgreSQL separately (or use `docker compose up db`) and run the backend and frontend directly:

- Backend: `uvicorn app.main:app --reload --port 8000`
- Frontend: `ng serve --port 4200 --proxy-config src/proxy.conf.json`

The proxy config routes `/api` to `localhost:8000` during development.

---

## 6. Known Limitations (PoC Scope)

- **No authentication or authorization** — any user can generate/modify rotas
- **No local holidays** — the date.nager.at API provides national/regional Spanish holidays but not municipal ones. Local holidays would need a supplementary static file.
- **Greedy algorithm** — may not find optimal solutions for very small pools (2-3 doctors). A constraint programming solver (e.g., OR-Tools) would be needed for guaranteed optimality.
- **No undo** — rota replacements and re-generation are not reversible
- **Desktop-only** — no mobile-responsive layout
- **Single city** — one city configured per deployment; multi-city would require architectural changes
