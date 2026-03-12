# Assignment Algorithm

**Source:** [`backend/app/services/assignment.py`](../backend/app/services/assignment.py)

The scheduling algorithm is a **single-pass balanced round-robin** that assigns both Atencion Continuada (AC) and Atencion Primaria (AP) for each day before moving to the next.

---

## Overview

```
For each day D in the year (Jan 1 → Dec 31):
  1. Build eligible doctor pool (rest-day filtering)
  2. Pick AC doctor (sort by equity → hours → sparsity)
  3. Pick AP doctor (exclude AC doctor, same sort)
  4. Update tracking (hours, shift counts, last-assigned date)
```

---

## Step-by-Step

### 1. Build the eligible pool

All doctors are split into two groups based on their previous day's assignments:

- **Rested:** not assigned on D-1
- **Unrested:** assigned on D-1

If there are **>= 2 rested** doctors, only rested doctors are eligible. Otherwise, the full pool is used — the rest-day rule becomes a **soft constraint** to avoid dead ends in small pools (2–3 doctors).

### 2. Pick the AC doctor

Eligible doctors are sorted by a composite key (ascending):

| Priority | Criterion | Purpose |
|----------|-----------|---------|
| 1st | Fewest shifts of this day-type (weekday/saturday/holiday) | Day-type equity |
| 2nd | Fewest total AC hours | Hour balance |
| 3rd | Largest gap since last assignment (any service) | Sparsity |

The top candidate is assigned AC.

### 3. Pick the AP doctor

The AC doctor is removed from the candidate list (HC-1: no dual AC+AP same day). The remaining doctors are sorted by the same composite key, but using AP-specific counters. The top candidate is assigned AP.

### 4. Update tracking

For both the AC and AP doctor:
- `last_assigned_global[doctor]` = D (used for rest-day and sparsity checks)
- Increment their service-specific hour counter by the day's duration
- Increment their service-specific day-type shift counter

---

## Constraints

| ID | Rule | Enforcement |
|----|------|-------------|
| HC-1 | Different doctors for AC and AP each day | **Hard** — AP candidate list excludes the AC pick |
| HC-2 | Rest day: assigned on D → unavailable on D+1 | **Hard** for pools >= 4; **soft** for smaller pools |
| HC-3 | Minimum hours: 135h/year AC, 425h/year AP per doctor | **Soft** — warnings returned if not met |
| HC-4 | Exactly one doctor per service type per day | **Hard** — guaranteed by loop structure |

---

## Feasibility Check (pre-generation)

Before the main loop runs, the algorithm validates the pool:

- **Pool < 2 doctors** → hard error (`InfeasiblePoolError`). It's impossible to fill both AC and AP slots with different doctors.
- **Pool too large for minimum hours** (total yearly hours / N < 135 for AC or < 425 for AP) → warning added, schedule is still generated.

After generation, actual per-doctor hours are checked against minimums. Any individual shortfalls are added as additional warnings.

---

## Why single-pass matters

The rest-day rule (HC-2) applies **across both service types**: if a doctor is assigned AC on Monday, they are blocked from both AC *and* AP on Tuesday. This cross-service coupling is why AC and AP must be assigned together per day.

The original two-pass design (all AC for the year, then all AP) couldn't enforce this — it had no way to know that an AC assignment on day D would conflict with an AP assignment on day D+1. The single-pass approach uses one global `last_assigned_global` dictionary that tracks the most recent assignment regardless of service type, making rest-day enforcement straightforward.

---

## Optimization goals (priority order)

1. **Day-type equity** — each doctor gets roughly the same count (±1) of weekday, Saturday, and holiday shifts within each service type
2. **Hour equity** — minimize the max-min total hour difference across doctors
3. **Sparsity** — maximize gaps between consecutive on-call assignments for each doctor

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

- **Greedy, not optimal.** The algorithm picks the locally best candidate each day. For pools of 5+ doctors this produces well-balanced schedules. For very small pools (2–3 doctors), a constraint programming solver (e.g., Google OR-Tools) would be needed for guaranteed optimality.
- **No backtracking.** Once a day is assigned, it's never revisited. This keeps the algorithm O(D × N) where D = days in year and N = pool size, but means it can't recover from suboptimal early choices.
- **Rest-day softness.** For pools < 4, enforcing strict rest days may create dead ends. The algorithm gracefully degrades by allowing unrested doctors when necessary, rather than failing.

---

## Data structures

| Structure | Type | Purpose |
|-----------|------|---------|
| `last_assigned_global` | `dict[str, date \| None]` | Last assignment date per doctor (any service) — rest-day + sparsity |
| `ac_hours` / `ap_hours` | `dict[str, int]` | Cumulative hours per doctor per service — hour equity |
| `ac_{weekday,saturday,holiday}_count` | `dict[str, int]` | Shift counts per doctor per day-type per service — day-type equity |

All structures are indexed by doctor ID and initialized to zero/None at the start of generation.
