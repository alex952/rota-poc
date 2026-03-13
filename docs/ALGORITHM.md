# Assignment Algorithm

**Source:** [`backend/app/services/assignment.py`](../backend/app/services/assignment.py)

The scheduling algorithm generates a full-year on-call schedule for a **single rota type** (AC or AP). AC and AP are generated independently with separate doctor pools.

---

## Overview

```
generate_rota(year, rota_type, pool, day_classifications):
  1. Compute doctors_per_day from pool size and minimum hours
  2. For each day D in the year:
     a. Build eligible doctor pool (rest-day filtering)
     b. Pick `doctors_per_day` doctors (sort by behind-target → equity → hours → sparsity)
     c. Update tracking (hours, shift counts, last-assigned date)
  3. Validate minimum hours (HARD constraint)
  4. Return schedule + stats
```

---

## Step-by-Step

### 1. Compute doctors_per_day

The algorithm auto-computes how many doctors are needed per day to ensure minimum hours can be met:

```python
total_yearly_hours = sum(d.duration_hours for d in day_classifications)
min_hours = 1620 if rota_type == "AC" else 425  # AC: 135h/month × 12
doctors_per_day = ceil(len(pool) * min_hours / total_yearly_hours)
```

Example calculations (~6,635 total AC hours/year):
- AC pool of 4 → ceil(4 × 1620 / 6635) = ceil(0.98) = **1 doctor/day**
- AC pool of 5 → ceil(5 × 1620 / 6635) = ceil(1.22) = **2 doctors/day**
- AC pool of 8 → ceil(8 × 1620 / 6635) = ceil(1.95) = **2 doctors/day**
- AP pool of 10 → ceil(10 × 425 / 6635) = ceil(0.64) = **1 doctor/day**

### 2. Build the eligible pool

All doctors are split into two groups based on their previous day's assignments:

- **Rested:** not assigned on D-1
- **Unrested:** assigned on D-1

If there are enough rested doctors (>= `doctors_per_day`), only rested doctors are eligible. Otherwise, the full pool is used — the rest-day rule becomes a **soft constraint** to avoid dead ends in small pools.

Additionally, doctors already assigned today (when `doctors_per_day > 1`) are excluded from subsequent picks for the same day.

### 3. Pick the doctors

Eligible doctors are sorted by a composite key (ascending):

| Priority | Criterion | Purpose |
|----------|-----------|---------|
| 1st | "Behind target" — doctors below their hour target | Ensure minimum hours met |
| 2nd | Fewest shifts of this day-type (weekday/saturday/holiday) | Day-type equity |
| 3rd | Fewest total hours | Hour balance |
| 4th | Largest gap since last assignment | Sparsity |

The top `doctors_per_day` candidates are assigned.

### 4. Update tracking

For each assigned doctor:
- `last_assigned[doctor]` = D (used for rest-day and sparsity checks)
- Increment their hour counter by the day's duration
- Increment their day-type shift counter

### 5. Hard validation

After the full year is generated, every doctor's total hours are checked:
- **AC:** every doctor must have >= 1,620 hours/year
- **AP:** every doctor must have >= 425 hours/year

If any doctor falls short, an `InfeasiblePoolError` is raised. This is a **hard constraint** — the rota is rejected, not returned with warnings.

---

## Constraints

| ID | Rule | Enforcement |
|----|------|-------------|
| HC-1 | Separate AC/AP pools — a doctor belongs to one pool only | **Hard** — enforced by caller (separate pool per generate call) |
| HC-2 | Rest day: assigned on D → unavailable on D+1 (within same rota type) | **Hard** for pools >= 2×doctors_per_day; **soft** for smaller pools |
| HC-3 | Minimum hours: 1,620h/year AC, 425h/year AP per doctor | **Hard** — `InfeasiblePoolError` raised if not met |
| HC-4 | `doctors_per_day` auto-computed | **Hard** — guaranteed by algorithm |

---

## Feasibility Check (pre-generation)

Before the main loop runs, the algorithm validates the pool:

- **Pool must have >= `doctors_per_day + doctors_per_day` doctors** (need enough for rest-day rotation). If not, `InfeasiblePoolError` is raised.
- Safety check: if `doctors_per_day × total_yearly_hours / pool_size < min_hours`, the configuration is infeasible.

---

## Why independent per-type generation matters

With separate AC and AP pools:
- There is **no cross-type coupling** — AC rest days don't affect AP and vice versa
- Each generate call handles one type with its own pool, its own rest-day tracking, and its own validation
- The calendar merges both types on the frontend for display

This is a significant simplification from the previous single-pass design where AC and AP assignments were coupled through shared rest-day tracking.

---

## Optimization goals (priority order)

1. **Minimum hours** — every doctor must reach the hard minimum (1,620h AC or 425h AP)
2. **Day-type equity** — each doctor gets roughly the same count (±1) of weekday, Saturday, and holiday shifts
3. **Hour equity** — minimize the max-min total hour difference across doctors
4. **Sparsity** — maximize gaps between consecutive on-call assignments for each doctor

These are encoded in the sort key: the first sort field dominates, with ties broken by subsequent fields.

---

## Day types and durations

| Condition | Day Type | Duration | Shift |
|-----------|----------|----------|-------|
| Sunday, or date in holiday set | `holiday` | 23h | 09:00 → 08:00+1 |
| Saturday (not a holiday) | `saturday` | 18h | 15:00 → 09:00+1 |
| All other days | `weekday` | 17h | 15:00 → 08:00+1 |

**Precedence:** Holiday > Saturday > Weekday. A Saturday that is also a public holiday is classified as `holiday` (23h, not 18h).

---

## Trade-offs and limitations

- **Greedy, not optimal.** The algorithm picks the locally best candidates each day. For pools of 4+ doctors this produces well-balanced schedules. For very small pools (2–3 doctors), a constraint programming solver (e.g., Google OR-Tools) would be needed for guaranteed optimality.
- **No backtracking.** Once a day is assigned, it's never revisited. This keeps the algorithm O(D × N × K) where D = days in year, N = pool size, and K = doctors_per_day, but means it can't recover from suboptimal early choices.
- **Rest-day softness.** For small pools, enforcing strict rest days may create dead ends. The algorithm gracefully degrades by allowing unrested doctors when necessary, rather than failing.
- **Hard minimums.** Unlike the previous soft-constraint approach, the algorithm now **rejects** schedules that don't meet minimums. This means very large pools may be infeasible (not enough hours to distribute).

---

## Data structures

| Structure | Type | Purpose |
|-----------|------|---------|
| `last_assigned` | `dict[str, date \| None]` | Last assignment date per doctor — rest-day + sparsity |
| `total_hours` | `dict[str, int]` | Cumulative hours per doctor — hour equity + minimum validation |
| `{weekday,saturday,holiday}_count` | `dict[str, int]` | Shift counts per doctor per day-type — day-type equity |

All structures are indexed by doctor ID and initialized to zero/None at the start of generation.
