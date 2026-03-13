# Implementation Guide

**Companion documents:** [PRD.md](./PRD.md) | [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md) | [ALGORITHM.md](./ALGORITHM.md)

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
| `rotas` | One row per generated rota (year + type) | `year`, `rota_type` (unique together), `doctors_per_day`, `city`, `generated_at`, `pool` (JSONB snapshot) |
| `rota_doctors` | Doctor pool members for a rota | FK to `rotas`, `doctor_id`, `name`, `department` |
| `rota_assignments` | One row per doctor per day per rota | FK to `rotas`, `date`, `doctor_id` (unique together per rota), `day_type` |
| `holidays` | Cached holiday data per year/city | `year`, `city`, `date`, `name` |

**Indexes:** `rota_assignments(rota_id, doctor_id)`, `holidays(year, city)`.

**Migrations:** Managed via Alembic. The initial migration (`001_initial_schema.py`) creates all four tables. On Docker startup, `alembic upgrade head` runs automatically before the app starts.

### 2.3 API Endpoints

All endpoints are under `/api/v1`.

#### `GET /config`
Returns the configured city. The frontend calls this on page load to display the city name.

#### `POST /rota/generate`
Accepts `{ year, rota_type, pool[] }`. Orchestrates:
1. Fetch/cache holidays for the configured city
2. Classify all days in the year (weekday/saturday/holiday)
3. Run the assignment algorithm (auto-computes `doctors_per_day`)
4. Delete any existing rota for that year and type
5. Persist the new rota (rotas, rota_doctors, rota_assignments)
6. Calculate and return stats

Returns 201 with full `RotaResponse`. Minimum hours are hard constraints — returns 400 (`InfeasiblePoolError`) if pool cannot meet minimums. Returns 502 if the holiday API is unreachable.

#### `GET /rota/{year}/{rota_type}`
Retrieves a stored rota for a specific type (AC or AP). Optional `?doctor_id=X` parameter filters assignments. Returns 404 if no rota exists.

#### `GET /rota/{year}`
Returns a list of all rotas (AC and/or AP) for the year. Returns 404 if none exist.

#### `PATCH /rota/{year}/{rota_type}/replace`
Accepts `{ date, old_doctor_id, new_doctor_id }`. Swaps the doctor for a single day assignment within the specified rota type. Recalculates and returns updated stats. Returns 404 if no matching assignment is found.

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

This is the core of the system. It generates a full-year on-call schedule for a single rota type (AC or AP). AC and AP rotas are generated independently with separate doctor pools.

#### Hard Constraints

| ID | Rule |
|----|------|
| HC-1 | AC and AP have **separate doctor pools**. A doctor belongs to one pool only. |
| HC-2 | Post-on-call rest day: a doctor assigned on day D is unavailable on D+1 within the same rota type (soft when pool < 4) |
| HC-3 | Minimum hours: AC doctors >= 1,620h/year (135h/month × 12), AP doctors >= 425h/year. **Hard constraint** — raises `InfeasiblePoolError` if not met. |
| HC-4 | `doctors_per_day` auto-computed: `ceil(pool_size × min_hours / total_yearly_hours)` |

#### Optimization Goals (priority order)

1. **Day-type equity:** Each doctor gets roughly the same count (±1) of weekday, Saturday, and holiday shifts
2. **Hour equity:** Minimize the max-min total hour difference across doctors
3. **Sparsity:** Maximize gaps between consecutive on-call assignments

#### Algorithm: Independent Per-Type Balanced Round-Robin

The algorithm generates one rota type at a time. Each call handles one type (AC or AP):

```
Input: rota_type, pool[], day_classifications[]

1. Compute doctors_per_day:
   total_yearly_hours = sum of all day durations
   min_hours = 1620 if AC, 425 if AP
   doctors_per_day = ceil(len(pool) * min_hours / total_yearly_hours)

2. For each day D in the year:
   a. Build eligible set:
      - Exclude doctors assigned on D-1 (rest day, if enough alternatives)
      - Exclude doctors already assigned today (if doctors_per_day > 1)
   b. Sort eligible by: ("behind target" priority, fewest shifts of this day_type,
      fewest total hours, largest gap)
   c. Assign top `doctors_per_day` candidates
   d. Update tracking: hours, day-type counts, last_assigned_date

3. Validate (HARD):
   - AC: every doctor >= 1620h/year
   - AP: every doctor >= 425h/year
   - Raise InfeasiblePoolError if any doctor falls short
```

#### Feasibility Check

Before generating, the algorithm validates the pool:
- Pool must have >= `doctors_per_day + doctors_per_day` doctors (need enough for rest-day rotation)
- If `doctors_per_day × total_yearly_hours / pool_size < min_hours`, infeasible (safety check)
- If infeasible → **hard error** (`InfeasiblePoolError`)

#### Rest-Day Softness

The rest-day constraint (HC-2) is enforced as a **soft constraint** when the pool is too small. With 2-3 doctors, strict rest-day enforcement may create dead ends. The algorithm falls back to allowing unrested doctors when fewer than the required number of rested doctors are available.

#### Key Implementation Detail: Independent Per-Type Generation

Because AC and AP now have separate pools, there is **no cross-type coupling**. Rest days apply per rota type only (AC rest days don't affect AP and vice versa). Each call to `generate_rota()` handles one type independently.

### 2.6 Stats Calculation (`app/services/stats.py`)

Given a schedule (list of day assignments) and the doctor pool, calculates per-doctor:
- Total on-call hours
- Monthly hours breakdown (`monthly_hours: dict[int, int]`)
- Shift counts by day type (weekday, Saturday, Sunday/holiday)

---

## 3. Frontend

### 3.1 Architecture

Angular 19+ standalone components with signal-based state management. No NgModules — all components use the `imports` array in their `@Component` decorator.

### 3.2 Services

| Service | Responsibility |
|---------|---------------|
| `ConfigService` | Fetches `GET /api/v1/config`, caches with `shareReplay(1)` |
| `RotaService` | All rota CRUD operations — `generateRota(year, rotaType, pool)`, `getRota(year, rotaType)`, `getRotas(year)`, `replaceDoctor(year, rotaType, request)` |
| `DoctorPoolService` | Manages doctor pool state via signals, loads from `doctors.json`. Provides `acDoctors` and `apDoctors` computed signals for filtered pools. |
| `NotificationService` | Toast notification queue with auto-dismiss (5s for normal, 10s for warnings) |

### 3.3 Component Hierarchy

```
AppComponent (root orchestrator — manages dual AC/AP state)
├── Header: city name, "Doctor Rota" title, stats toggle button
├── DoctorPoolComponent (left panel, ~280px fixed)
│   ├── AC/AP tab bar (switches pool view)
│   ├── DoctorCardComponent[] (cdkDrag, displays name + department + rota_type)
│   ├── AddDoctorDialogComponent (reactive form, defaultRotaType from active tab)
│   └── Buttons: "+ Add Doctor", "Generate {AC|AP} Rota" / "Re-generate {AC|AP} Rota"
├── CalendarComponent (center, fills right panel — shows BOTH AC and AP)
│   ├── Header bar: month nav (‹/›), month label (click → today), doctor filter pill, year input
│   ├── MonthViewComponent (single month at a time, uses MergedDayAssignment)
│   │   └── DayCellComponent[] (~30 per month)
│   │       └── Day number, AC section (blue, multi-doctor), AP section (green, multi-doctor), cdkDropList
│   └── Empty state (shown when no rota exists for selected year)
├── StatsPanelComponent (right, slide-out, hidden by default — has AC/AP toggle)
│   └── DoctorStatsRowComponent[] (one per doctor for active tab's type)
├── ConfirmDialogComponent (modal overlay for re-generation)
├── ReplaceDoctorDialogComponent (multi-doctor replacement picker)
└── NotificationComponent (toast stack, top-right corner — supports error/success/info/warning)
```

### 3.4 User Flows

**Page Load:**
1. `ConfigService.getConfig()` → display city in header
2. `DoctorPoolService.loadDoctors()` → populate left panel from `doctors.json` (doctors have `rota_type`)
3. `RotaService.getRotas(currentYear)` → fetches list of AC/AP rotas. Populates `acSchedule`/`apSchedule` signals. Calendar shows merged view of both.

**Generate Rota:**
1. User clicks "Generate {type} Rota" (or "Re-generate" with confirm dialog). Type determined by active pool tab.
2. Loading overlay shown on calendar
3. `RotaService.generateRota(year, rotaType, pool)` → update corresponding schedule + stats
4. `mergedSchedule` recomputed to show both AC and AP in calendar
5. On success → show green success notification
6. On error → show error notification with API detail

**Drag-and-Drop Replacement:**
1. User drags `DoctorCardComponent` from the active pool tab
2. Drops onto a `DayCellComponent` (which has `cdkDropList`)
3. Rota type inferred from active pool tab. If day has multiple doctors for that type, `ReplaceDoctorDialogComponent` appears — user picks which doctor to replace.
4. `RotaService.replaceDoctor(year, rotaType, request)` → update day cell + recalculate stats

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

`src/assets/doctors.json` contains the pre-populated doctor pool with `rota_type`:
```json
[
  { "id": "doc-001", "name": "Dr. Garcia", "department": "Medicina General", "rota_type": "AC" },
  { "id": "doc-002", "name": "Dr. Lopez", "department": "Pediatria", "rota_type": "AC" },
  { "id": "doc-011", "name": "Dr. Navarro", "department": "Urgencias", "rota_type": "AP" }
]
```

Each doctor belongs to either the AC or AP pool. Users can add more doctors via the UI (defaulting to the active pool tab's type). The pool for the active tab is sent to the backend on rota generation.

---

## 4. Testing

### 4.1 Strategy

| Layer | Framework | Test Type | Count |
|-------|-----------|-----------|-------|
| Backend algorithm | pytest | Unit | 23 |
| Backend holiday service | pytest | Unit (with mocked HTTP) | 7 |
| Backend API | pytest + TestClient | Integration | 16 |
| Frontend services | vitest + HttpTestingController | Unit | 14 |
| Frontend components | vitest + TestBed | Component | 53 |
| Frontend app | vitest + TestBed | Integration | 15 |
| **Total** | | | **128** |

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
| 3.1 Rota Generation | AC-3.1.1 to AC-3.1.13 | `test_assignment.py`, `test_api.py` |
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
