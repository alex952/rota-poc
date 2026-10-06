import {
  AC_POOL_4,
  AP_POOL_12,
  AP_POOL_5,
  AP_POOL_8,
  AP_POOL_9,
  HOLIDAYS_2026,
  YEAR_2026,
  toHolidaySet,
} from '../helpers/fixtures';

import {
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

  it('keeps AC and AP generation independent', () => {
    const acRota = generateRota(YEAR_2026, 'AC', AC_POOL_4, dayClassifications);
    const apRota = generateRota(YEAR_2026, 'AP', AP_POOL_9, dayClassifications);

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

  it('applies AC shift durations and times per day type', () => {
    const rota = generateRota(YEAR_2026, 'AC', AC_POOL_4, dayClassifications);

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

describe('AP rota — refuerzo diario y festivos doblados', () => {
  const dayClassifications = classifyYear(YEAR_2026, toHolidaySet(HOLIDAYS_2026));

  it('asigna turnos AP de 7h en laborables y sábados (15:00–22:00)', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_9, dayClassifications);
    const nonHolidayDays = rota.schedule.filter((day) => day.dayType !== 'holiday');

    expect(nonHolidayDays.length).toBeGreaterThan(0);
    expect(
      nonHolidayDays.every(
        (day) =>
          day.durationHours === 7 && day.shiftStart === '15:00' && day.shiftEnd === '22:00',
      ),
    ).toBe(true);
  });

  it('asigna dos primarios AP en cada festivo, ambos con turnos de 12h (10:00–22:00)', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_9, dayClassifications);
    const holidayDays = rota.schedule.filter((day) => day.dayType === 'holiday');

    expect(holidayDays.length).toBeGreaterThan(0);
    for (const day of holidayDays) {
      expect(day.doctors).toHaveLength(2);
      expect(day.durationHours).toBe(12);
      expect(day.shiftStart).toBe('10:00');
      expect(day.shiftEnd).toBe('22:00');
      const doctorIds = new Set(day.doctors.map((doctor) => doctor.doctorId));
      expect(doctorIds.size).toBe(2);
    }
  });

  it('los AP no superan las 425h anuales (máximo)', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_9, dayClassifications);

    for (const doctor of rota.stats.doctors) {
      expect(doctor.totalHours).toBeLessThanOrEqual(425);
      expect(doctor.targetHours).toBe(425);
    }
  });

  it('un grupo AP grande es válido: nadie supera el máximo aunque tenga pocas horas', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_12, dayClassifications);

    for (const doctor of rota.stats.doctors) {
      expect(doctor.totalHours).toBeLessThanOrEqual(425);
    }
  });

  it('rechaza un grupo AP demasiado pequeño porque superaría el máximo de horas', () => {
    expect(() => generateRota(YEAR_2026, 'AP', AP_POOL_5, dayClassifications)).toThrow(
      /demasiado pequeño.*máximo de 425h/i,
    );
    expect(() => generateRota(YEAR_2026, 'AP', AP_POOL_8, dayClassifications)).toThrow(
      /demasiado pequeño.*al menos 9 médicos/i,
    );
  });

  it('asigna sólo 1 AP en laborables y sábados aunque el pool sea grande', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_12, dayClassifications);

    for (const day of rota.schedule) {
      if (day.dayType === 'holiday') {
        expect(day.doctors).toHaveLength(2);
      } else {
        expect(day.doctors).toHaveLength(1);
      }
    }
    expect(rota.doctorsPerDay).toBe(1);
  });
});

describe('AC rota — cobertura fija y validación de pool', () => {
  const dayClassifications = classifyYear(YEAR_2026, toHolidaySet(HOLIDAYS_2026));

  it('asigna exactamente 1 AC primary por día independientemente del tamaño del pool', () => {
    const largePool = [
      ...AC_POOL_4,
      { id: 'doc-005', name: 'Dr. Romero', department: 'Cardio' },
      { id: 'doc-006', name: 'Dr. Diaz', department: 'Cardio' },
      { id: 'doc-007', name: 'Dr. Iglesias', department: 'Cardio' },
      { id: 'doc-008', name: 'Dr. Marin', department: 'Cardio' },
    ];

    expect(() => generateRota(YEAR_2026, 'AC', largePool, dayClassifications)).toThrow(
      /demasiado grande/i,
    );
  });

  it('mantiene 1 AC primary por día con pool factible', () => {
    const rota = generateRota(YEAR_2026, 'AC', AC_POOL_4, dayClassifications);

    for (const day of rota.schedule) {
      expect(day.doctors).toHaveLength(1);
    }
    expect(rota.doctorsPerDay).toBe(1);
  });
});
