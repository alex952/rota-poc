# Product Requirements Document: Doctor Rota Assignment App

**Version:** 1.0
**Date:** 2026-03-12
**Status:** Draft - PoC Scope
**Source:** REQUIREMENTS.md

---

## 1. Product Overview

The Doctor Rota Assignment application automates the scheduling of on-call services for doctors. The system calculates yearly rota assignments ensuring fairness and compliance with minimum hour requirements, and provides a visual interface for viewing and managing the schedule.

This is a **Proof of Concept (PoC)** — authentication, authorization, and production security concerns are explicitly out of scope.

---

## 2. Glossary

| Term | Definition |
|------|-----------|
| **Atencion Continuada (AC)** | One of two on-call service types. Separate doctor pool. Minimum 1,620 hours/year (135h/month averaged) per doctor. |
| **Atencion Primaria (AP)** | One of two on-call service types. Separate doctor pool. Minimum 425 hours/year per doctor. |
| **Rota** | The on-call duty schedule for the year, generated independently per service type. |
| **Pool** | The set of doctors available for rota assignment in a given year. AC and AP have **separate** pools — a doctor belongs to one pool only. |
| **Holiday** | A public holiday (national, regional, or local) for the hospital's city in Spain. |
| **doctors_per_day** | The number of doctors assigned per day per rota type, auto-computed by the algorithm from pool size and minimum hour constraints. |

---

## 3. Features

### 3.1 — Rota Generation

**Description:** Given a pool of doctors and a target year, the system calculates a full-year on-call assignment schedule that satisfies all constraints.

#### Business Rules

- BR-1: Each AC doctor must be assigned **at least 1,620 hours/year** (135h/month averaged over 12 months) of Atencion Continuada. This is a **hard constraint** — the algorithm raises an error if not met.
- BR-2: Each AP doctor must be assigned **at least 425 hours/year** of Atencion Primaria. This is a **hard constraint** — the algorithm raises an error if not met.
- BR-3: On-call shift durations are fixed by day type:
  | Day Type | Shift | Duration |
  |----------|-------|----------|
  | Monday–Friday | 15:00 → 08:00+1 | 17 hours |
  | Saturday | 15:00 → 09:00+1 | 18 hours |
  | Sunday / Public Holiday | 09:00 → 08:00+1 | 23 hours |
- BR-4: The schedule must be **equitable** — doctors should have the same (or as close as possible) number of each day type assigned and total hours.
- BR-5: AC and AP have **separate doctor pools**. A doctor belongs to one pool only. Rotas are generated independently per type.
- BR-6: Sundays that are also public holidays count as a single Sunday/Holiday shift (no double-counting).
- BR-7: The number of doctors assigned per day per rota type (`doctors_per_day`) is **auto-computed** by the algorithm based on pool size and minimum hour constraints. Formula: `ceil(pool_size × min_hours / total_yearly_hours)`.
- BR-8: **Post-on-call rest day** — a doctor who is on call on day D is **unavailable** for assignment on day D+1. Rest days apply **per rota type only** (AC rest days don't affect AP and vice versa, since pools are separate). Soft constraint for pools < 4.
- BR-9: On-call assignments should be **as sparse as possible** — maximize the gap between a doctor's consecutive on-call days.
- BR-10: If a public holiday falls on a Saturday, it is classified as a **holiday** (23h shift), not a Saturday (18h shift). Holiday classification always takes precedence.

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-3.1.1 | **Given** a valid pool of doctors, a rota type (AC or AP), and a target year, **when** the generate rota endpoint is called, **then** a full 365/366-day schedule is returned with `doctors_per_day` doctors assigned per day. |
| AC-3.1.2 | **Given** a generated AC rota, **when** individual doctor hours are summed, **then** every doctor has >= 1,620 hours/year (hard constraint — error if not met). |
| AC-3.1.3 | **Given** a generated AP rota, **when** individual doctor hours are summed, **then** every doctor has >= 425 hours/year (hard constraint — error if not met). |
| AC-3.1.4 | **Given** a generated rota, **when** comparing the total hours across doctors, **then** the difference between the doctor with the most hours and the doctor with the fewest hours is minimized (target: <= 1 shift difference per day-type). |
| AC-3.1.5 | **Given** a generated rota, **when** inspecting public holidays and Sundays, **then** they use the 23-hour (09:00→08:00+1) shift duration. |
| AC-3.1.6 | **Given** a generated rota, **when** inspecting Saturdays, **then** they use the 18-hour (15:00→09:00+1) shift duration. |
| AC-3.1.7 | **Given** a generated rota, **when** inspecting weekdays (Mon-Fri, non-holiday), **then** they use the 17-hour (15:00→08:00+1) shift duration. |
| AC-3.1.8 | **Given** a year, **when** generating the rota, **then** the system fetches and correctly classifies public holidays for the configured city. |
| AC-3.1.9 | **Given** separate AC and AP pools, **then** doctors belong to one pool only and rotas are generated independently per type. |
| AC-3.1.10 | **Given** a doctor is assigned on-call on day D, **then** that doctor has no assignment on day D+1 within the same rota type (rest day per type only). |
| AC-3.1.11 | **Given** a generated rota, **when** comparing the gaps between a doctor's consecutive on-call days, **then** the algorithm maximizes spacing (assignments are as sparse as possible). |
| AC-3.1.12 | **Given** a public holiday that falls on a Saturday, **then** that day is classified as holiday (23h shift), not Saturday (18h). |
| AC-3.1.13 | **Given** a pool of doctors, **when** the algorithm runs, **then** `doctors_per_day` is auto-computed as `ceil(pool_size × min_hours / total_yearly_hours)`. |

---

### 3.2 — Rota Persistence & Retrieval

**Description:** Generated rotas are stored and can be queried for a given year.

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-3.2.1 | **Given** a rota has been generated for year Y and rota type T, **when** the query endpoint is called with year Y and type T, **then** the stored rota is returned. |
| AC-3.2.2 | **Given** no rota exists for year Y and type T, **when** the query endpoint is called, **then** a 404 or empty response is returned indicating no rota exists. |
| AC-3.2.3 | **Given** a stored rota, **when** queried with a doctor filter, **then** only that doctor's assignments are returned. |
| AC-3.2.4 | **Given** a rota is re-generated for a year/type that already has one, **then** the previous rota for that type is replaced entirely. |

---

### 3.3 — Doctor Replacement

**Description:** A specific doctor in an existing rota can be replaced with another doctor for a specific assignment.

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-3.3.1 | **Given** a stored rota and a valid replacement request (date, old doctor, new doctor), **when** the replacement is made, **then** the assignment for that date reflects the new doctor. |
| AC-3.3.2 | **Given** a replacement, **when** the rota stats are recalculated, **then** hour totals reflect the swap. |

---

### 3.4 — Holiday Resolution

**Description:** The system retrieves public holidays for the hospital's configured city in Spain to correctly classify day types. The city is an **app-level configuration** set before running the application, shared by both the backend and frontend.

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-3.4.1 | **Given** the configured city and a target year, **when** holidays are fetched, **then** national, autonomous community, and local holidays are all included. |
| AC-3.4.2 | **Given** fetched holidays, **when** generating the rota, **then** holiday dates are classified as Sunday/Holiday day-type (23-hour shifts). |
| AC-3.4.3 | **Given** the external holiday source is unavailable, **when** generating the rota, **then** the system returns an appropriate error rather than generating an incorrect schedule. |
| AC-3.4.4 | **Given** a Saturday that is also a public holiday, **then** it is classified as holiday (23h), not Saturday (18h). |

---

### 3.5 — Rota Statistics

**Description:** The system returns per-doctor statistics alongside the rota.

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-3.5.1 | **Given** a generated or stored rota, **when** stats are requested, **then** the response includes per-doctor: total hours, monthly hours breakdown, count of shifts by day-type (weekday/Saturday/Sunday-holiday). |
| AC-3.5.2 | **Given** stats, **when** reviewing equity, **then** the stats clearly show any imbalance across doctors. |

---

### 3.6 — Schedule UI: Calendar View

**Description:** A web interface displays the rota in a two-column layout with a calendar view.

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-3.6.1 | **Given** the UI loads, **when** a rota exists for the selected year, **then** the calendar displays all assignments for each day of each month. |
| AC-3.6.2 | **Given** the UI loads, **when** no rota exists for the selected year, **then** the calendar is empty and the generate button reads "Generate Rota". |
| AC-3.6.3 | **Given** a rota exists, **then** the generate button reads "Re-generate Rota". |
| AC-3.6.4 | **Given** the user clicks "Re-generate Rota", **then** a confirmation dialog warns that the current rota will be replaced before proceeding. |
| AC-3.6.5 | **Given** the UI, **then** a year selector is visible and defaults to the current year. |
| AC-3.6.6 | **Given** the user changes the year, **then** the calendar reloads data for the selected year. |
| AC-3.6.7 | **Given** the UI loads, **then** the configured city name is displayed in the interface. |

---

### 3.7 — Schedule UI: Doctor Pool Panel

**Description:** The left panel shows the pool of doctors available for assignment.

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-3.7.1 | **Given** the UI loads, **then** the left panel displays doctor cards pre-populated from a static configuration file. |
| AC-3.7.2 | **Given** a doctor card, **then** it displays the doctor's name and department. |
| AC-3.7.3 | **Given** the user clicks "Add Doctor", **then** they can add a new doctor to the pool (name, department). |
| AC-3.7.4 | **Given** doctor cards, **then** they are draggable and can be dropped onto calendar day cells to assign replacements. |
| AC-3.7.5 | **Given** the bottom of the left panel, **then** buttons for "Add Doctor" and "Generate Rota" / "Re-generate Rota" are visible. |

---

### 3.8 — Schedule UI: Stats Panel

**Description:** A hidden side panel shows rota statistics per doctor.

#### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-3.8.1 | **Given** a rota is loaded, **when** the user opens the stats panel, **then** per-doctor hour breakdowns are displayed. |
| AC-3.8.2 | **Given** the stats panel, **then** it shows total hours, monthly hours breakdown, and shift counts by day-type for each doctor. Stats panel has AC/AP toggle to show stats for the active type. |
| AC-3.8.3 | **Given** the stats panel is closed by default, **then** it can be toggled open/closed. |

---

## 4. Out of Scope (PoC)

The following are explicitly **not** in scope for this PoC:

- User authentication and authorization
- Role-based access control
- Audit logging
- Multi-hospital / multi-location support
- Doctor availability preferences or constraints (e.g., vacation, conflicts)
- Undo/redo of rota changes
- Notification system (email/SMS)
- Mobile-responsive design (desktop-only is acceptable)
- Production deployment (only local and Docker-based environments)

---

## 5. Assumptions

1. Doctors belong to either the AC pool or the AP pool, not both. Pools are managed separately.
2. Each day has `doctors_per_day` doctors assigned per rota type (auto-computed by the algorithm).
3. The hospital city for holiday resolution is **configurable at the app level** (static configuration set before running the application), shared by backend and frontend.
4. The static doctor configuration file is a simple JSON file bundled with the frontend, with each doctor specifying their `rota_type` (AC or AP).
5. "Equitable" means minimizing the max difference in total hours and in count-per-day-type across all doctors within a rota type.
6. A doctor on call on day D has a mandatory rest day on D+1 within the same rota type. AC rest days don't affect AP and vice versa.
7. Minimum hours are **hard constraints**: AC doctors must reach 1,620h/year (135h/month × 12), AP doctors must reach 425h/year.

---

## 6. Resolved Decisions

These were initially open questions, now resolved with stakeholder input:

| # | Question | Resolution |
|---|----------|------------|
| RD-1 | Should AC and AP share a single doctor pool? | **No.** AC and AP have separate pools. A doctor belongs to one pool only. Rotas are generated independently per type. |
| RD-2 | What specific Spanish city should holidays be resolved for? Should this be configurable? | **Configurable at app level.** City is a static app-level configuration set before running the application. It applies to both backend (holiday resolution) and frontend (displayed in UI). |
| RD-3 | Is there a maximum number of consecutive on-call days for a doctor? | **Implicit via rest-day rule.** A doctor on call on day D is off on D+1, so consecutive on-call is impossible. Additionally, assignments should be as sparse as possible. |
| RD-4 | Should holidays that fall on a Saturday use Saturday or Holiday shift hours? | **Holiday takes precedence.** A Saturday that is a public holiday uses the 23-hour holiday shift, not the 18-hour Saturday shift. |
| RD-5 | AngularJS (1.x, EOL) vs Angular (v19+)? | **Angular v19+.** The modern, actively maintained framework will be used. |
| RD-6 | How many doctors per day per rota type? | **Algorithm-computed.** `doctors_per_day = ceil(pool_size × min_hours / total_yearly_hours)`. Not a user parameter. |
| RD-7 | Are minimum hours soft or hard constraints? | **Hard constraints.** The algorithm raises an `InfeasiblePoolError` if any doctor falls short of the minimum. |
| RD-8 | Are AC minimum hours yearly or monthly? | **Monthly averaged.** AC doctors need 135h/month × 12 = 1,620h/year. The algorithm validates the yearly total. |
