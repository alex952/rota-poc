/**
 * Compara las estrategias 'balanced' y 'wheels' sobre los mismos datos y calcula
 * métricas de disparidad. Uso (desde backend/):
 *   npx ts-node --transpile-only scripts/compare-strategies.ts
 * Salida: docs/strategy-comparison/results.json + tablas markdown por stdout.
 *
 * Festivos: se obtienen de https://date.nager.at reutilizando fetchHolidays del
 * servicio de festivos (nacionales + Comunidad Valenciana, ES-VC). El servicio no
 * maneja festivos locales de Alicante. Si la red falla se usa FALLBACK_HOLIDAYS.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

import { addDays, fromIsoDate, toIsoDate } from '../src/common/date.utils';
import {
  HolidayApiItem,
  HolidayRecord,
  classifyYear,
  fetchHolidays,
} from '../src/holidays/holidays.service';
import {
  AP_MAX_HOURS_YEAR,
  AC_MIN_HOURS_YEAR,
  generateRota,
} from '../src/scheduling/assignment.service';
import { InfeasiblePoolError } from '../src/scheduling/errors';
import { DoctorInput, RotaSchedule, RotaType } from '../src/scheduling/scheduling.types';
import { assignWithWheels, wheelForDay, WheelId } from '../src/scheduling/strategies/wheels.strategy';

const CITY = 'Alicante';
const YEARS = [2026, 2027];
const SIZES: Record<RotaType, number[]> = { AC: [3, 4, 5, 6], AP: [5, 8, 12, 17] };
const STRATEGIES = ['balanced', 'wheels'] as const;
type Strat = (typeof STRATEGIES)[number];
const CATS: WheelId[] = ['weekday', 'saturday', 'sunday', 'holiday'];

// Respaldo documentado (sólo si falla la red; el proxy del entorno devolvió 403 para
// date.nager.at). Aproximación al calendario que devolvería Nager filtrado a ES-VC:
// nacionales (1 ene, 6 ene, Viernes Santo, 1 may, 15 ago, 12 oct, 1 nov, 6 dic, 8 dic,
// 25 dic) + Comunidad Valenciana (San José 19 mar, Jueves Santo, Lunes de Pascua,
// 9 oct). Sin festivos locales de Alicante. No traslada festivos que caen en domingo.
const FALLBACK_HOLIDAYS: Record<number, string[]> = {
  2026: ['2026-01-01', '2026-01-06', '2026-03-19', '2026-04-02', '2026-04-03', '2026-04-06', '2026-05-01', '2026-08-15', '2026-10-09', '2026-10-12', '2026-11-01', '2026-12-06', '2026-12-08', '2026-12-25'],
  2027: ['2027-01-01', '2027-01-06', '2027-03-19', '2027-03-25', '2027-03-26', '2027-03-29', '2027-05-01', '2027-08-15', '2027-10-09', '2027-10-12', '2027-11-01', '2027-12-06', '2027-12-08', '2027-12-25'],
};

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const std = (v: number[]) => {
  const m = mean(v);
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
};
const r2 = (x: number) => Math.round(x * 100) / 100;
const range = (v: number[]) => ({ min: Math.min(...v), max: Math.max(...v), range: Math.max(...v) - Math.min(...v) });

async function loadHolidays(): Promise<{ source: string; byYear: Record<number, HolidayRecord[]> }> {
  const byYear: Record<number, HolidayRecord[]> = {};
  try {
    for (const year of YEARS) {
      const fetcher = async (y: number): Promise<HolidayApiItem[]> => {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/ES`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as HolidayApiItem[];
      };
      byYear[year] = await fetchHolidays(year, CITY, { findCached: async () => [], upsertMany: async () => undefined }, fetcher);
    }
    return { source: 'red: https://date.nager.at/api/v3/PublicHolidays/{año}/ES filtrado con fetchHolidays (ES-VC)', byYear };
  } catch (e) {
    console.error(`AVISO: fallo de red (${(e as Error).message}); se usa la lista hardcodeada.`);
    for (const year of YEARS) {
      byYear[year] = FALLBACK_HOLIDAYS[year].map((date) => ({ year, city: CITY, date, name: 'hardcodeado' }));
    }
    return { source: 'hardcodeado (FALLBACK_HOLIDAYS en el script)', byYear };
  }
}

function buildPool(rotaType: RotaType, size: number): DoctorInput[] {
  const seed = (JSON.parse(readFileSync(join(__dirname, '../../frontend/src/assets/doctors.json'), 'utf8')) as any[])
    .filter((d) => d.rota_type === rotaType)
    .map((d) => ({ id: d.id, name: d.name, department: d.department }));
  const pool = seed.slice(0, size);
  for (let i = seed.length + 1; pool.length < size; i += 1) {
    pool.push({ id: `synth-${rotaType}-${i}`, name: `Sintético ${i}`, department: 'Sintético' });
  }
  return pool;
}

// Rueda pura sin saltos: n-ésima asignación de cada rueda = pool[n mod size].
function pureWheel(s: RotaSchedule, pool: DoctorInput[]): string[][] {
  const counters: Record<WheelId, number> = { weekday: 0, saturday: 0, sunday: 0, holiday: 0 };
  return s.schedule.map((day) => {
    const w = wheelForDay(day);
    const ids: string[] = [];
    for (let i = 0; i < day.doctors.length; i += 1) {
      ids.push(pool[counters[w] % pool.length].id);
      counters[w] += 1;
    }
    return ids;
  });
}

// Variantes sólo de análisis (no son estrategias de producto): se reconstruye un
// cuadrante con los mismos días, duraciones y cobertura que `base`, cambiando quién hace cada día.
function withDoctors(base: RotaSchedule, pool: DoctorInput[], ids: string[][]): RotaSchedule {
  const nameById = new Map(pool.map((p) => [p.id, p.name]));
  return {
    ...base,
    warnings: [],
    schedule: base.schedule.map((day, i) => ({
      ...day,
      doctors: ids[i].map((doctorId) => ({ doctorId, doctorName: nameById.get(doctorId) ?? doctorId })),
    })),
  };
}

// Ruedas escalonadas: misma lógica que wheels (saltar y conservar turno con deuda contada)
// pero con punteros iniciales repartidos en el grupo.
function staggeredWheels(base: RotaSchedule, pool: DoctorInput[]): string[][] {
  const n = pool.length;
  const offsets = { weekday: 0, saturday: Math.floor(n / 4), sunday: Math.floor((2 * n) / 4), holiday: Math.floor((3 * n) / 4) };
  return assignWithWheels(
    { pool, days: base.schedule, requiredByDay: base.schedule.map((d) => d.doctors.length) },
    offsets,
  ).map((chosen) => chosen.map((d) => d.id));
}

const dayKey = (ids: string[]) => [...ids].sort().join('|');

function metrics(s: RotaSchedule, pool: DoctorInput[], rotaType: RotaType) {
  const ids = pool.map((p) => p.id);
  const hours: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
  const monthly: Record<string, number[]> = Object.fromEntries(ids.map((i) => [i, Array(12).fill(0)]));
  const cat: Record<WheelId, Record<string, number>> = {
    weekday: Object.fromEntries(ids.map((i) => [i, 0])),
    saturday: Object.fromEntries(ids.map((i) => [i, 0])),
    sunday: Object.fromEntries(ids.map((i) => [i, 0])),
    holiday: Object.fromEntries(ids.map((i) => [i, 0])),
  };
  const dutyDates: Record<string, string[]> = Object.fromEntries(ids.map((i) => [i, []]));
  const dutySet: Record<string, Set<string>> = Object.fromEntries(ids.map((i) => [i, new Set<string>()]));

  for (const day of s.schedule) {
    const date = toIsoDate(day.date);
    const month = day.date.getUTCMonth();
    for (const d of day.doctors) {
      hours[d.doctorId] += day.durationHours;
      monthly[d.doctorId][month] += day.durationHours;
      cat[wheelForDay(day)][d.doctorId] += 1;
      dutyDates[d.doctorId].push(date);
      dutySet[d.doctorId].add(date);
    }
  }
  const hv = ids.map((i) => hours[i]);
  const limit = rotaType === 'AC' ? AC_MIN_HOURS_YEAR : AP_MAX_HOURS_YEAR;
  const under = hv.filter((h) => h < limit);
  const over = hv.filter((h) => h > limit);

  let restViol = 0, streak3 = 0, satSun = 0, friSatSun = 0;
  const gapsAll: number[] = [];
  const gapStds: number[] = [];
  let gap2 = 0;
  for (const id of ids) {
    const set = dutySet[id];
    const dates = dutyDates[id].sort();
    const gaps: number[] = [];
    for (let k = 0; k < dates.length; k += 1) {
      const d = dates[k];
      if (set.has(addDays(d, -1))) restViol += 1;
      if (set.has(addDays(d, -1)) && set.has(addDays(d, -2))) streak3 += 1;
      const wd = fromIsoDate(d).getUTCDay();
      if (wd === 0) {
        if (set.has(addDays(d, -1))) satSun += 1;
        if (set.has(addDays(d, -1)) && set.has(addDays(d, -2))) friSatSun += 1;
      }
      if (k > 0) gaps.push(Math.round((fromIsoDate(d).getTime() - fromIsoDate(dates[k - 1]).getTime()) / 86400000));
    }
    gapsAll.push(...gaps);
    gap2 += gaps.filter((g) => g === 2).length;
    if (gaps.length > 1) gapStds.push(std(gaps));
  }
  const monthlyStds = ids.map((i) => std(monthly[i]));
  const maxMonthly = Math.max(...ids.map((i) => Math.max(...monthly[i])));

  return {
    hours: { mean: r2(mean(hv)), std: r2(std(hv)), ...range(hv), cv: r2(std(hv) / mean(hv)), perDoctor: hours },
    limit: {
      rotaType,
      belowMinCount: rotaType === 'AC' ? under.length : null,
      totalDeficit: rotaType === 'AC' ? under.reduce((a, h) => a + (limit - h), 0) : null,
      aboveMaxCount: rotaType === 'AP' ? over.length : null,
      totalExcess: rotaType === 'AP' ? over.reduce((a, h) => a + (h - limit), 0) : null,
      warnings: s.warnings,
    },
    wheelCounts: Object.fromEntries(CATS.map((c) => [c, { ...range(ids.map((i) => cat[c][i])), perDoctor: cat[c] }])),
    rest: { violations: restViol, streaks3: streak3 },
    weekends: { satAndSunSameDoctor: satSun, friSatSunSameDoctor: friSatSun },
    gaps: {
      min: gapsAll.length ? Math.min(...gapsAll) : null,
      mean: r2(mean(gapsAll)),
      meanStdPerDoctor: r2(mean(gapStds)),
      gaps2days: gap2,
    },
    monthly: { meanStd: r2(mean(monthlyStds)), maxStd: r2(Math.max(...monthlyStds)), maxMonthlyHours: maxMonthly },
    assignments: s.schedule.reduce((a, d) => a + d.doctors.length, 0),
    totalHours: hv.reduce((a, b) => a + b, 0),
  };
}

async function main() {
  const { source, byYear } = await loadHolidays();
  const results: any[] = [];
  for (const year of YEARS) {
    const set = new Set(byYear[year].map((h) => fromIsoDate(h.date)));
    const days = classifyYear(year, set);
    for (const rotaType of ['AC', 'AP'] as RotaType[]) {
      for (const size of SIZES[rotaType]) {
        const pool = buildPool(rotaType, size);
        const entry: any = { year, rotaType, groupSize: size, strategies: {} };
        const schedules: Partial<Record<Strat, RotaSchedule>> = {};
        for (const strat of STRATEGIES) {
          try {
            const s = generateRota(year, rotaType, pool, days, undefined, strat);
            schedules[strat] = s;
            entry.strategies[strat] = metrics(s, pool, rotaType);
          } catch (e) {
            if (e instanceof InfeasiblePoolError) entry.strategies[strat] = { infeasible: e.message };
            else throw e;
          }
        }
        const b = schedules.balanced, w = schedules.wheels;
        if (b && w) {
          const same = b.schedule.filter((d, i) => dayKey(d.doctors.map((x) => x.doctorId)) === dayKey(w.schedule[i].doctors.map((x) => x.doctorId))).length;
          entry.concordancePct = r2((100 * same) / b.schedule.length);
        }
        if (w) {
          const pure = pureWheel(w, pool);
          const diff = w.schedule.filter((d, i) => dayKey(d.doctors.map((x) => x.doctorId)) !== dayKey(pure[i])).length;
          entry.strategies.wheels.skipRuleImpactDays = diff;
          const pureMetrics = metrics(withDoctors(w, pool, pure), pool, rotaType);
          entry.pureWheel = {
            restViolations: pureMetrics.rest.violations,
            satAndSunSameDoctor: pureMetrics.weekends.satAndSunSameDoctor,
            friSatSunSameDoctor: pureMetrics.weekends.friSatSunSameDoctor,
          };
          const staggeredSchedule = withDoctors(w, pool, staggeredWheels(w, pool));
          entry.strategies.staggered = metrics(staggeredSchedule, pool, rotaType);
        }
        results.push(entry);
      }
    }
  }

  const commit = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
  const out = {
    meta: { executedAt: new Date().toISOString(), commit, city: CITY, holidaysSource: source },
    holidays: Object.fromEntries(YEARS.map((y) => [y, byYear[y].map((h) => ({ date: h.date, name: h.name }))])),
    scenarios: results,
  };
  const dir = join(__dirname, '../../docs/strategy-comparison');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'results.json'), JSON.stringify(out, null, 2));

  // Coherencia
  for (const r of results) {
    const b = r.strategies.balanced, w = r.strategies.wheels;
    if (b?.totalHours !== undefined && w?.totalHours !== undefined && (b.totalHours !== w.totalHours || b.assignments !== w.assignments)) {
      console.error(`INCOHERENCIA en ${r.year} ${r.rotaType} ${r.groupSize}`);
    }
  }

  // Tablas
  console.log(`Festivos: ${source}\nCommit: ${commit}\n`);
  const table = (title: string, get: (st: any, r: any) => string) => {
    console.log(`### ${title}\n\n| Escenario | balanced | wheels |\n|---|---|---|`);
    for (const r of results) {
      const cell = (s: Strat) => (r.strategies[s]?.infeasible ? 'INFEASIBLE' : get(r.strategies[s], r));
      console.log(`| ${r.rotaType} ${r.groupSize} (${r.year}) | ${cell('balanced')} | ${cell('wheels')} |`);
    }
    console.log('');
  };
  table('Horas por médico (media / desv. típica / mín–máx / rango / CV)', (s) => `${s.hours.mean} / ${s.hours.std} / ${s.hours.min}–${s.hours.max} / ${s.hours.range} / ${s.hours.cv}`);
  table('Límite de horas (AC: nº <1620h, déficit; AP: nº >425h, exceso) y nº de avisos', (s) =>
    (s.limit.rotaType === 'AC' ? `${s.limit.belowMinCount} méd., déficit ${s.limit.totalDeficit}h` : `${s.limit.aboveMaxCount} méd., exceso ${s.limit.totalExcess}h`) + `, ${s.limit.warnings.length} aviso(s)`);
  for (const c of CATS) table(`Rango de guardias por médico, rueda ${c} (mín–máx, rango)`, (s) => `${s.wheelCounts[c].min}–${s.wheelCounts[c].max}, ${s.wheelCounts[c].range}`);
  table('Descanso: violaciones (médico, D con D−1) / rachas de 3 días', (s) => `${s.rest.violations} / ${s.rest.streaks3}`);
  table('Fines de semana: sáb+dom mismo médico / vie+sáb+dom mismo médico', (s) => `${s.weekends.satAndSunSameDoctor} / ${s.weekends.friSatSunSameDoctor}`);
  table('Huecos entre guardias: mín / media / desv. media por médico / nº huecos de 2 días', (s) => `${s.gaps.min} / ${s.gaps.mean} / ${s.gaps.meanStdPerDoctor} / ${s.gaps.gaps2days}`);
  table('Reparto mensual: media de desv. típica / máx desv. típica / mayor carga mensual (h)', (s) => `${s.monthly.meanStd} / ${s.monthly.maxStd} / ${s.monthly.maxMonthlyHours}`);
  // --- Variantes de análisis: rueda pura y ruedas escalonadas ---
  console.log('### Rueda pura (ruedas estrictas sin saltos, todas desde el índice 0): descanso / sáb+dom mismo médico / vie+sáb+dom mismo médico\n\n| Escenario | Violaciones de descanso | Sáb+dom mismo médico | Vie+sáb+dom mismo médico |\n|---|---|---|---|');
  for (const r of results) console.log(`| ${r.rotaType} ${r.groupSize} (${r.year}) | ${r.pureWheel?.restViolations ?? 'n/d'} | ${r.pureWheel?.satAndSunSameDoctor ?? 'n/d'} | ${r.pureWheel?.friSatSunSameDoctor ?? 'n/d'} |`);
  console.log('');
  const table3 = (title: string, get: (st: any) => string) => {
    console.log(`### Ruedas escalonadas (punteros iniciales 0, ⌊N/4⌋, ⌊2N/4⌋, ⌊3N/4⌋): ${title}\n\n| Escenario | balanced | wheels | escalonadas |\n|---|---|---|---|`);
    for (const r of results) {
      const cell = (k: string) => (!r.strategies[k] ? 'n/d' : r.strategies[k].infeasible ? 'INFEASIBLE' : get(r.strategies[k]));
      console.log(`| ${r.rotaType} ${r.groupSize} (${r.year}) | ${cell('balanced')} | ${cell('wheels')} | ${cell('staggered')} |`);
    }
    console.log('');
  };
  table3('horas por médico (media / desv. típica / mín–máx / rango / CV)', (s) => `${s.hours.mean} / ${s.hours.std} / ${s.hours.min}–${s.hours.max} / ${s.hours.range} / ${s.hours.cv}`);
  table3('rango de guardias por rueda (laborables / sábados / domingos / festivos)', (s) => CATS.map((c) => s.wheelCounts[c].range).join(' / '));
  table3('descanso: violaciones / rachas de 3 días', (s) => `${s.rest.violations} / ${s.rest.streaks3}`);
  table3('fines de semana: sáb+dom mismo médico / vie+sáb+dom mismo médico', (s) => `${s.weekends.satAndSunSameDoctor} / ${s.weekends.friSatSunSameDoctor}`);
  table3('huecos entre guardias: mín / media / desv. media por médico / nº huecos de 2 días', (s) => `${s.gaps.min} / ${s.gaps.mean} / ${s.gaps.meanStdPerDoctor} / ${s.gaps.gaps2days}`);
  table3('reparto mensual: media de desv. típica / máx desv. típica / mayor carga mensual (h)', (s) => `${s.monthly.meanStd} / ${s.monthly.maxStd} / ${s.monthly.maxMonthlyHours}`);

  // Distribución por médico en AC 5 y AP 5
  const VARIANTS: [string, string][] = [['balanced', 'balanced'], ['wheels', 'wheels'], ['staggered', 'escalonadas']];
  for (const r of results.filter((x) => x.groupSize === 5)) {
    const pool = buildPool(r.rotaType, 5);
    console.log(`### Distribución por médico, ${r.rotaType} 5 (${r.year}): sábados / domingos / festivos / horas totales\n\n| Médico | ${VARIANTS.map(([, l]) => l).join(' | ')} |\n|---|${VARIANTS.map(() => '---').join('|')}|`);
    for (const [idx, p] of pool.entries()) {
      const cells = VARIANTS.map(([k]) => {
        const st = r.strategies[k];
        if (!st || st.infeasible) return 'n/d';
        return `${st.wheelCounts.saturday.perDoctor[p.id]} / ${st.wheelCounts.sunday.perDoctor[p.id]} / ${st.wheelCounts.holiday.perDoctor[p.id]} / ${st.hours.perDoctor[p.id]}`;
      });
      console.log(`| ${idx + 1} (${p.id}) | ${cells.join(' | ')} |`);
    }
    console.log('');
  }
  console.log('### Concordancia y impacto de saltos\n\n| Escenario | Concordancia balanced=wheels (% días) | Días wheels distintos de rueda pura |\n|---|---|---|');
  for (const r of results) console.log(`| ${r.rotaType} ${r.groupSize} (${r.year}) | ${r.concordancePct ?? 'n/d'} | ${r.strategies.wheels?.skipRuleImpactDays ?? 'n/d'} |`);
}

main().catch((e) => { console.error(e); process.exit(1); });
