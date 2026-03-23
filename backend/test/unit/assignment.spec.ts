import {
  AC_POOL_4,
  AP_POOL_5,
  HOLIDAYS_2026,
  REDUCED_AC_POOL_4,
  YEAR_2026,
  reducedPool,
  toHolidaySet,
} from '../helpers/fixtures';

import {
  buildTargetHours,
  computeDoctorsPerDay,
  generateRota,
} from '../../src/scheduling/assignment.service';
import { classifyYear } from '../../src/holidays/holidays.service';

describe('Assignment domain', () => {
  const dayClassifications = classifyYear(YEAR_2026, toHolidaySet(HOLIDAYS_2026));
  const totalYearlyHours = dayClassifications.reduce((sum, day) => sum + day.durationHours, 0);

  it('computes doctors per day for AC and AP pools', () => {
    expect(computeDoctorsPerDay('AC', AC_POOL_4.length, totalYearlyHours)).toBe(1);
    expect(computeDoctorsPerDay('AC', 5, totalYearlyHours)).toBe(2);
    expect(computeDoctorsPerDay('AP', 10, totalYearlyHours)).toBe(1);
  });

  it('builds personalized AC targets for reduced-hours doctors', () => {
    const targets = buildTargetHours('AC', REDUCED_AC_POOL_4, dayClassifications);
    const standardTargets = buildTargetHours('AC', AC_POOL_4, dayClassifications);

    expect(targets[REDUCED_AC_POOL_4[0].id]).toBeLessThan(standardTargets[REDUCED_AC_POOL_4[0].id]);
    expect(targets[REDUCED_AC_POOL_4[1].id]).toBeGreaterThan(0);
  });

  it('keeps AC and AP generation independent', () => {
    const acRota = generateRota(YEAR_2026, 'AC', AC_POOL_4, dayClassifications);
    const apRota = generateRota(YEAR_2026, 'AP', AP_POOL_5, dayClassifications);

    expect(acRota.rotaType).toBe('AC');
    expect(apRota.rotaType).toBe('AP');
    expect(acRota.schedule).toHaveLength(365);
    expect(apRota.schedule).toHaveLength(365);
  });

  it('enforces the hard minimum hours and rest-day rule', () => {
    const rota = generateRota(YEAR_2026, 'AC', AC_POOL_4, dayClassifications);

    for (const doctor of rota.stats.doctors) {
      expect(doctor.totalHours).toBeGreaterThanOrEqual(1620);
    }

    const scheduleByDate = new Map(rota.schedule.map((day) => [day.date.toISOString().slice(0, 10), day]));
    for (const day of rota.schedule) {
      const nextDate = new Date(day.date);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const nextKey = nextDate.toISOString().slice(0, 10);
      const nextDay = scheduleByDate.get(nextKey);
      if (!nextDay) {
        continue;
      }

      const todayDoctors = new Set(day.doctors.map((doctor) => doctor.doctorId));
      const tomorrowDoctors = new Set(nextDay.doctors.map((doctor) => doctor.doctorId));
      const overlap = [...todayDoctors].filter((id) => tomorrowDoctors.has(id));
      expect(overlap).toHaveLength(0);
    }
  });

  it('adds linked refuerzos only for reduced-hours primary assignments', () => {
    const rota = generateRota(YEAR_2026, 'AC', reducedPool(), dayClassifications);
    const reducedDays = rota.schedule.filter((day) =>
      day.doctors.some((doctor) => doctor.doctorId === REDUCED_AC_POOL_4[0].id),
    );

    expect(reducedDays.length).toBeGreaterThan(0);
    expect(reducedDays.every((day) => day.refuerzos.length === 1)).toBe(true);
    expect(
      rota.schedule.every((day) => {
        if (day.dayType === 'holiday') {
          return day.durationHours === 23 && day.shiftStart === '09:00' && day.shiftEnd === '08:00+1';
        }
        if (day.dayType === 'saturday') {
          return day.durationHours === 18 && day.shiftStart === '15:00' && day.shiftEnd === '09:00+1';
        }
        return day.durationHours === 17 && day.shiftStart === '15:00' && day.shiftEnd === '08:00+1';
      }),
    ).toBe(true);
  });
});
