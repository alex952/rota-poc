# Historical Rota Analysis — PAS Aaiun 2026

**Source:** Human-scheduled monthly rota documents (Jan 2026 – Jan 2027), covering AC (Atencion Continuada / PAS) assignments at a Spanish military hospital deployment.

This document captures patterns and lessons from the real human-scheduled rota to guide future algorithm alignment.

---

## Pool Composition

| Role | Count | Details |
|------|-------|---------|
| Main doctors (AC/PAS) | 4 | Isabel, Marina, Cynthia, Cesar |
| Residents | 21 | Numbered R:1 through R:21, paired 1–2 per shift alongside the main doctor |
| Vacation substitutes | ~25 entries | Labeled `VAC/N`, fill in during main doctor absences |
| Junior substitutes | ~12 entries | Labeled `J/N`, appear Oct–Dec (possibly replacing Isabel) |

**Notable:** Isabel disappears from monthly hour totals from October onward and is absent from the yearly summary. She appears to have been partially or fully replaced by J/ and VAC/ substitutes — suggesting mid-year departure or extended leave.

---

## Rotation Pattern

January 2026 shows a **perfect strict 4-day rotation** with zero deviations:

```
Day 1: Isabel    Day 5: Isabel    Day 9: Isabel   ...
Day 2: Marina    Day 6: Marina    Day 10: Marina  ...
Day 3: Cynthia   Day 7: Cynthia   Day 11: Cynthia ...
Day 4: Cesar     Day 8: Cesar     Day 12: Cesar   ...
```

This gives each doctor:
- **1 shift every 4 days** (3 full rest days between shifts)
- **~7–8 shifts/month**
- **~91 shifts/year**

The rotation is completely deterministic — no optimization logic, no balancing by day type. Whichever day type (weekday/saturday/holiday) falls on your rotation slot is what you get.

---

## Monthly Hours

### Per-Doctor Monthly Totals (2026)

| Month | Cynthia | Cesar | Marina | Avg | Spread |
|-------|---------|-------|--------|-----|--------|
| Jan | 144 | 138 | 149 | 143.7 | 11h |
| Feb | 147 | 145 | 145 | 145.7 | 2h |
| Mar | 138 | 149 | 149 | 145.3 | 11h |
| Apr | 144 | 156 | 150 | 150.0 | 12h |
| May | 149 | 145 | 144 | 146.0 | 5h |
| Jun | 153 | 150 | 154 | 152.3 | 4h |
| Jul | 150 | 143 | 150 | 147.7 | 7h |
| Aug | 149 | 138 | 150 | 145.7 | 12h |
| Sep | 140 | 143 | 140 | 141.0 | 3h |
| Oct | 150 | 151 | 156 | 152.3 | 6h |
| Nov | 152 | 145 | 150 | 149.0 | 7h |
| Dec | 149 | 144 | 151 | 148.0 | 7h |

**Monthly spread:** 1h–12h between doctors (average 6.8h).

Base hours often land at **126h** or **143–149h**, with manual adjustments of **+7h, +12h, +21h** added to reach target. These adjustments likely come from covering extra shifts, vacation replacements, or compensation hours.

### Yearly Totals (from December document)

| Doctor | Raw Hours | After Vacation Deduction | Difference |
|--------|-----------|--------------------------|------------|
| Cynthia | 1,765h | 1,567h | -198h |
| Cesar | 1,747h | 1,622h | -125h |
| Marina | 1,788h | 1,643h | -145h |
| **Spread** | **41h** | **76h** | |

The theoretical expectation for a strict 4-rotation over 365 days is ~1,644h/year (~137h/month). All three tracked doctors exceed this — the surplus comes from covering Isabel's shifts and substitute work.

Isabel's yearly total is not recorded, confirming she did not complete the full year.

---

## Shift Structure

Each daily assignment includes:

1. **One main doctor** from the pool of 4
2. **One or two residents** (R:N) paired with the main doctor
3. **Shift times and durations** matching our algorithm's day-type classification:
   - Weekday: 17h (15:00–08:00+1)
   - Saturday: 18h (15:00–09:00+1)
   - Holiday/Sunday: 23h (09:00–08:00+1)

Special notations found in the documents:
- `X/N` — appears ~once per doctor per month; likely a compensation or special duty day
- `VAC/N` — vacation substitute doctor taking a numbered shift
- `J/N` — junior or replacement doctor (concentrated in Oct–Dec)
- `Permiso` — permission/leave day

---

## Key Takeaways for Algorithm Alignment

### 1. Real pools are small

The actual pool has **4 main doctors** — far smaller than our test data (20 per pool). The algorithm must work well with pools of 4–5 doctors, which is the realistic operational scenario.

### 2. Strict rotation is the human baseline

The human scheduler uses a dead-simple sequential rotation with no optimization. It produces reasonable monthly equity (~7h spread) because the fixed rotation is inherently fair over time. Our algorithm should at minimum match this equity level.

### 3. Two-tier staffing (doctor + residents)

Each shift pairs a main doctor with 1–2 residents from a pool of 21. We currently model only the main doctor assignment. **Resident pairing could be a future feature** — the resident pool is much larger and likely has its own rotation and constraints.

### 4. Manual adjustments are the norm

The `+7h`, `+12h`, `+21h` additions on monthly totals show that real schedules require post-generation tweaking. Our drag-and-drop replacement feature maps directly to this need. The algorithm produces a baseline; humans will always fine-tune.

### 5. Vacation handling is ad-hoc

Vacation coverage is handled by substitute doctors (VAC/, J/) rather than redistributing among the remaining pool. This suggests a future feature: vacation-aware generation that either excludes doctors for date ranges or slots in named substitutes.

### 6. Pool changes happen mid-year

Isabel's departure shows that pool composition changes during the year are real. The system should support re-generating a rota when doctors join or leave, preserving already-served assignments where possible.

### 7. The 135h/month AC minimum matches reality

Actual monthly hours cluster around 138–156h, with the target clearly in the 135–150h range. Our 1,620h/year (135h/month x 12) hard constraint is well-calibrated to real-world expectations.

### 8. Day-type equity is an improvement over manual

The rigid human rotation means Saturday/holiday distribution is random — some months a doctor gets disproportionately more weekends. Our algorithm actively balances day-type distribution (weekday/saturday/holiday counts within ±1), which is a tangible improvement over the manual approach.

### 9. No cross-type coupling observed

The documents cover only AC/PAS assignments. AP assignments are presumably scheduled separately (different documents, different pool). This confirms our design decision to generate AC and AP rotas independently.

---

## Future Considerations

Based on this analysis, potential future enhancements to explore:

- **Resident pairing** — model the 21-resident pool as a second tier, with its own rotation constraints
- **Vacation-aware generation** — accept date ranges where doctors are unavailable, auto-slot substitutes
- **Mid-year re-generation** — handle pool changes (additions/departures) without rebuilding the entire year
- **Manual adjustment tracking** — record and display post-generation hour adjustments (the +7h, +12h pattern)
- **Small pool optimization** — ensure the algorithm degrades gracefully to a simple rotation for pools of 3–4, since that matches the real-world baseline
