# Historical Rota Analysis

**Sources:**
- **PAS Aaiun** — Human-scheduled monthly rota documents (Jan 2026 – Jan 2027), military hospital deployment
- **PAS Alicante Sur** — Human-scheduled monthly rota documents (Jan 2026 – Jan 2027), domestic hospital

Both cover AC (Atencion Continuada / PAS) assignments. This document captures patterns and lessons from real human-scheduled rotas to guide future algorithm alignment.

---

## Pool Composition

### Aaiun

| Role | Count | Details |
|------|-------|---------|
| Main doctors (AC/PAS) | 4 | Isabel, Marina, Cynthia, Cesar |
| AP refuerzo references | 21 | Numbered `R:1` through `R:21`; these refer to Atencion Primaria reinforcement staff, not residents, and are not part of the AC/PAS core rotation |
| Vacation substitutes | ~25 entries | Labeled `VAC/N`, fill in during main doctor absences |
| Junior substitutes | ~12 entries | Labeled `J/N`, appear Oct–Dec (possibly replacing Isabel) |

**Notable:** Isabel disappears from monthly hour totals from October onward and is absent from the yearly summary. She appears to have been partially or fully replaced by J/ and VAC/ substitutes — suggesting mid-year departure or extended leave.

### Alicante Sur

| Role | Count | Details |
|------|-------|---------|
| Main doctors (AC/PAS) | 5 (4 effective slots) | Miguel A, Paula, Fabiola, Ruth, Jessica |
| AP refuerzo references | 17 | Numbered `R:1` through `R:17`; these refer to Atencion Primaria reinforcement staff, not residents, and are not part of the AC/PAS core rotation |
| Vacation substitutes | Present | Labeled `VAC N`, used during summer and autumn months |

**Notable:** Ruth and Jessica are **always assigned together** on the same day — every cell reads "Ruth | Jessica" or "Jessica | Ruth". They share a single rotation slot (job-share / media jornada), making the effective pool **4 rotation slots** despite having 5 named doctors. Their monthly hours are nearly identical (differing by 0–2h in only 3 of 12 months). The documents include `Horas Ruth:N` and `Horas Paula:N` annotations to track partial-hour adjustments for the shared slot.

**Miguel A consistently under-hours:** Miguel averages 141h/month vs ~147h for others, with 4 months below 135h (Feb: 126h, Apr: 133h, Jul: 126h, Oct: 127h). This pattern of exactly 126h (= ~7 weekday shifts × 17h + 1 weekend) suggests he systematically receives fewer weekend/holiday shifts — a known weakness of rigid rotations without day-type balancing.

---

## Rotation Pattern

Both centers use a **strict 4-slot rotation** with zero deviations (verified across all months):

### Aaiun

```
Day 1: Isabel    Day 5: Isabel    Day 9: Isabel   ...
Day 2: Marina    Day 6: Marina    Day 10: Marina  ...
Day 3: Cynthia   Day 7: Cynthia   Day 11: Cynthia ...
Day 4: Cesar     Day 8: Cesar     Day 12: Cesar   ...
```

### Alicante Sur

```
Day 1: Miguel A       Day 5: Miguel A       ...
Day 2: Paula          Day 6: Paula          ...
Day 3: Ruth/Jessica   Day 7: Ruth/Jessica   ...
Day 4: Fabiola        Day 8: Fabiola        ...
```

Both give each slot:
- **1 shift every 4 days** (3 full rest days between shifts)
- **~7–8 shifts/month**
- **~91 shifts/year**

The rotation is completely deterministic — no optimization logic, no balancing by day type. Whichever day type (weekday/saturday/holiday) falls on your rotation slot is what you get.

---

## Monthly Hours

### Aaiun — Per-Doctor Monthly Totals (2026)

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

**Monthly spread:** 2h–12h (average 6.8h). Isabel excluded — she did not complete the full year.

### Alicante Sur — Per-Doctor Monthly Totals (2026)

| Month | Ruth | Jessica | Fabiola | Paula | Miguel A | Avg | Spread |
|-------|------|---------|---------|-------|----------|-----|--------|
| Jan | 144 | 144 | 138 | 149 | 150 | 145.0 | 12h |
| Feb | 140 | 140 | 145 | 145 | 126 | 139.2 | 19h |
| Mar | 138 | 140 | 149 | 149 | 144 | 144.0 | 11h |
| Apr | 144 | 144 | 156 | 150 | 133 | 145.4 | 23h |
| May | 149 | 149 | 145 | 144 | 149 | 147.2 | 5h |
| Jun | 146 | 147 | 150 | 147 | 144 | 146.8 | 6h |
| Jul | 150 | 150 | 143 | 150 | 126 | 143.8 | 24h |
| Aug | 149 | 149 | 138 | 150 | 144 | 146.0 | 12h |
| Sep | 140 | 140 | 143 | 140 | 143 | 141.2 | 3h |
| Oct | 150 | 150 | 151 | 156 | 127 | 146.8 | 29h |
| Nov | 152 | 152 | 149 | 150 | 149 | 150.4 | 3h |
| Dec | 150 | 150 | 144 | 151 | 152 | 149.4 | 8h |

**Monthly spread:** 3h–29h (average 12.9h). Significantly wider than Aaiun, driven largely by Miguel A's under-allocation on weekends.

### Hourly Patterns

Base hours often land at **126h** (≈ 7 weekday shifts × 17h + 1 partial) or **143–149h**, with manual adjustments of **+7h, +12h, +21h** added to reach target. These adjustments likely come from covering extra shifts, vacation replacements, or compensation hours. This pattern is consistent across both centers.

### Yearly Totals

**Aaiun** (from December document):

| Doctor | Raw Hours | After Vacation Deduction |
|--------|-----------|--------------------------|
| Cynthia | 1,765h | 1,567h |
| Cesar | 1,747h | 1,622h |
| Marina | 1,788h | 1,643h |
| **Spread** | **41h** | **76h** |

**Alicante Sur** (computed from monthly totals):

| Doctor | 2026 Hours |
|--------|-----------|
| Ruth | 1,752h |
| Jessica | 1,755h |
| Fabiola | 1,751h |
| Paula | 1,781h |
| Miguel A | 1,687h |
| **Spread** | **94h** |

The theoretical expectation for a strict 4-rotation over 365 days is ~1,644h/year (~137h/month). Both centers exceed this — the surplus comes from covering absent doctors' shifts and substitute work. Alicante Sur's wider spread (94h vs 41h) is almost entirely due to Miguel A being systematically under-allocated on weekends.

---

## Shift Structure

For the AC/PAS rota itself, both centers use the same core daily shift structure:

1. **One main AC/PAS doctor** (or a job-share pair) from the pool
2. **Shift times and durations** matching our algorithm's day-type classification:
   - Weekday: 17h (15:00–08:00+1)
   - Saturday: 18h (15:00–09:00+1)
   - Holiday/Sunday: 23h (09:00–08:00+1)

Important clarification on notation and scope:
- `R:N` does **not** mean residente; it means **refuerzo** and refers to **Atencion Primaria (AP)** reinforcement coverage
- Those `R:` entries should therefore not be treated as part of the AC/PAS staffing model analyzed here
- The Atencion Continuada staff on the special contract are a **separate on-call-only workforce**, not a normal recurring schedule pool comparable to the AC/PAS main-doctor rotation

Special notations found in the documents:
- `X/N` — appears ~once per doctor per month; likely a compensation or special duty day
- `VAC/N` or `VAC N` — vacation substitute doctor taking a numbered shift
- `J/N` — junior or replacement doctor (Aaiun only, concentrated in Oct–Dec)
- `Permiso` — permission/leave day
- `Horas Name:N` — partial hour tracking annotations (Alicante Sur, for job-share splitting)

---

## Key Takeaways for Algorithm Alignment

### 1. Real pools are small (4 effective slots)

Both centers operate with **4 effective rotation slots** — Aaiun has 4 doctors, Alicante Sur has 5 doctors but 2 (Ruth/Jessica) share a slot. This is far smaller than our test data (20 per pool). The algorithm must work well with pools of 4–5 doctors, which is the realistic operational scenario.

### 2. Strict rotation is the human baseline

Both centers use a dead-simple sequential rotation with no optimization. Aaiun achieves reasonable monthly equity (~7h spread) because the fixed rotation is inherently fair over time. However, Alicante Sur shows the weakness: without day-type balancing, individual doctors can be systematically under- or over-allocated on weekends (Miguel A's 94h yearly spread). Our algorithm should match Aaiun's equity at minimum and improve on Alicante Sur's.

### 3. Job-sharing is real

Alicante Sur demonstrates that two doctors can share a single rotation slot. Ruth and Jessica always appear together, with near-identical hours (0–2h difference). This is not currently modeled in our system. **A future feature could allow defining a "shared slot" where two doctors split one rotation position.**

### 4. AP refuerzo notation should not be modeled as AC secondary staffing

The `R:N` notation in the source rotas refers to **AP refuerzo**, not residents. That means this analysis should **not** infer a second AC staffing tier from those entries. This aligns with the current implementation: the generator already accepts a `rota_type` and produces **separate AC and AP rotas with separate pools**, rather than treating AP reinforcement as a second layer inside the AC rota.

### 5. Manual adjustments are the norm

The `+7h`, `+12h`, `+21h` additions on monthly totals show that real schedules require post-generation tweaking. Our drag-and-drop replacement feature maps directly to this need. The algorithm produces a baseline; humans will always fine-tune.

### 6. Vacation handling is ad-hoc

Vacation coverage is handled by substitute doctors (VAC/, J/) rather than redistributing among the remaining pool. This suggests a future feature: vacation-aware generation that either excludes doctors for date ranges or slots in named substitutes.

### 7. Pool changes happen mid-year

Isabel's departure shows that pool composition changes during the year are real. The system should support re-generating a rota when doctors join or leave, preserving already-served assignments where possible.

### 8. The 135h/month AC minimum matches reality

Both centers show actual monthly hours clustering around 126–156h, with the target clearly in the 135–150h range. Our 1,620h/year (135h/month x 12) hard constraint is well-calibrated to real-world expectations.

### 9. Day-type equity is a clear improvement over manual

The rigid human rotation means Saturday/holiday distribution is random. Alicante Sur's data proves this causes real inequity — Miguel A systematically gets fewer weekends, ending 94h below the highest doctor yearly. Our algorithm actively balances day-type distribution (weekday/saturday/holiday counts within ±1), which directly addresses this observed weakness.

### 10. AC and AP are correctly treated as separate scheduling domains in the current system

The clarified notation makes the separation cleaner: `R:` entries belong to **AP refuerzo**, while the main rota analyzed here is the **AC/PAS** doctor rotation. In addition, some Atencion Continuada personnel are on a **special on-call-only contract**, so they should not be treated as part of a normal monthly schedule pool. This validates the current system design, where the generate-rota flow already handles AC and AP independently by rota type, with separate pools and separate generation passes.

---

## Cross-Center Comparison

| Metric | Aaiun | Alicante Sur |
|--------|-------|--------------|
| Main doctor slots | 4 | 4 (5 doctors, 1 job-share) |
| Doctors per day | 1 | 1 (or 2 shared) |
| Rotation type | Strict 4-day | Strict 4-day |
| AP refuerzo references in source docs | `R:1`-`R:21` | `R:1`-`R:17` |
| Monthly hour range | 138–156h | 126–156h |
| Monthly spread (avg) | 6.8h | 12.9h |
| Yearly spread | 41h | 94h |
| Vacation subs | VAC/, J/ | VAC |
| Job-share | No | Yes (Ruth/Jessica) |
| Mid-year pool change | Yes (Isabel) | No |

The patterns are strikingly consistent across both centers despite different locations, staff, and operational contexts. The strict 4-day AC/PAS rotation, manual hour adjustments, and ad-hoc vacation handling appear to be standard practice across the Spanish military hospital system. The earlier apparent "two-tier" pattern should instead be understood as separate AP refuerzo notation alongside the AC rota, plus distinct on-call-only AC contract staff outside the normal schedule pool.

---

## Future Considerations

Based on this analysis, potential future enhancements to explore:

- **Special-contract AC on-call modeling** — if needed in future, model the Atencion Continuada on-call-only contract explicitly as its own scheduling mode rather than folding it into the standard AC rota
- **Vacation-aware generation** — accept date ranges where doctors are unavailable, auto-slot substitutes
- **Mid-year re-generation** — handle pool changes (additions/departures) without rebuilding the entire year
- **Manual adjustment tracking** — record and display post-generation hour adjustments (the +7h, +12h pattern)
- **Small pool optimization** — ensure the algorithm degrades gracefully to a simple rotation for pools of 3–4, since that matches the real-world baseline
- **Job-share support** — allow two doctors to share a single rotation slot, splitting hours and tracking individually
