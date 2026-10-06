import {
  AC_POOL_4,
  AP_POOL_5,
  AP_POOL_8,
  HOLIDAYS_2026,
  YEAR_2026,
  toHolidaySet,
} from '../helpers/fixtures';

import {
  computeDoctorsPerDay,
  generateRota,
} from '../../src/scheduling/assignment.service';
import { classifyDay, classifyYear } from '../../src/holidays/holidays.service';

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

describe('AP rota — refuerzo diario y segundo refuerzo en festivos consecutivos', () => {
  const isoDate = (day: { date: Date }) => day.date.toISOString().slice(0, 10);
  // Festivos de 2026 cuyo día anterior también es festivo (domingo incluido).
  const SEGUNDOS_FESTIVOS_2026 = [
    '2026-04-03', // Viernes Santo, tras Jueves Santo
    '2026-08-16', // domingo, tras el sábado festivo de la Asunción
    '2026-10-12', // lunes, tras domingo
    '2026-11-02', // lunes, tras domingo
    '2026-12-07', // lunes, tras domingo
    '2026-12-08', // martes, tercer festivo seguido
  ];

  const dayClassifications = classifyYear(YEAR_2026, toHolidaySet(HOLIDAYS_2026));

  it('asigna turnos AP de 7h en laborables y sábados (15:00–22:00)', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_5, dayClassifications);
    const nonHolidayDays = rota.schedule.filter((day) => day.dayType !== 'holiday');

    expect(nonHolidayDays.length).toBeGreaterThan(0);
    expect(
      nonHolidayDays.every(
        (day) =>
          day.durationHours === 7 && day.shiftStart === '15:00' && day.shiftEnd === '22:00',
      ),
    ).toBe(true);
  });

  it('aplica turnos AP de 12h en todos los festivos (10:00–22:00)', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_5, dayClassifications);
    const holidayDays = rota.schedule.filter((day) => day.dayType === 'holiday');

    expect(holidayDays.length).toBeGreaterThan(0);
    for (const day of holidayDays) {
      expect(day.durationHours).toBe(12);
      expect(day.shiftStart).toBe('10:00');
      expect(day.shiftEnd).toBe('22:00');
    }
  });

  it('asigna dos AP distintos sólo en los festivos precedidos de otro festivo', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_5, dayClassifications);
    const doubled = rota.schedule.filter((day) => day.doctors.length === 2);

    expect(doubled.map(isoDate)).toEqual(SEGUNDOS_FESTIVOS_2026);
    for (const day of doubled) {
      expect(new Set(day.doctors.map((doctor) => doctor.doctorId)).size).toBe(2);
    }
  });

  it('asigna un único AP en los festivos aislados y en el primero de una serie', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_5, dayClassifications);
    const byDate = new Map(rota.schedule.map((day) => [isoDate(day), day]));

    // Festivo aislado, domingo aislado, primer festivo de un par y domingo previo a un lunes festivo.
    for (const date of ['2026-01-01', '2026-01-04', '2026-04-02', '2026-10-11', '2026-12-06']) {
      expect(byDate.get(date)?.dayType).toBe('holiday');
      expect(byDate.get(date)?.doctors).toHaveLength(1);
    }
  });

  it('cuenta el 31 de diciembre anterior cuando está marcado como festivo', () => {
    // El 31-12-2026 es jueves: sólo es festivo si se marca como tal.
    const days2027 = classifyYear(2027, toHolidaySet([new Date('2027-01-01')]));
    const dec31 = new Date('2026-12-31');

    const conFestivo = generateRota(
      2027,
      'AP',
      AP_POOL_5,
      days2027,
      classifyDay(dec31, toHolidaySet([dec31])),
    );
    expect(isoDate(conFestivo.schedule[0])).toBe('2027-01-01');
    expect(conFestivo.schedule[0].doctors).toHaveLength(2);

    const sinFestivo = generateRota(
      2027,
      'AP',
      AP_POOL_5,
      days2027,
      classifyDay(dec31, toHolidaySet([])),
    );
    expect(sinFestivo.schedule[0].doctors).toHaveLength(1);
  });

  it('sin el día anterior al año, cuenta el 31 de diciembre sólo si cae en domingo', () => {
    // El 31-12-2028 es domingo, así que el 01-01-2029 es un segundo festivo.
    const days2029 = classifyYear(2029, toHolidaySet([new Date('2029-01-01')]));
    const rota = generateRota(2029, 'AP', AP_POOL_5, days2029);

    expect(isoDate(rota.schedule[0])).toBe('2029-01-01');
    expect(rota.schedule[0].doctors).toHaveLength(2);
  });

  it('los AP cumplen las 425h anuales mínimas con la nueva aritmética', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_5, dayClassifications);

    for (const doctor of rota.stats.doctors) {
      expect(doctor.totalHours).toBeGreaterThanOrEqual(425);
    }
  });

  it('asigna sólo 1 AP en laborables y sábados con el mayor pool factible', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_8.slice(0, 6), dayClassifications);

    for (const day of rota.schedule) {
      if (day.dayType !== 'holiday') {
        expect(day.doctors).toHaveLength(1);
      }
    }
    expect(rota.doctorsPerDay).toBe(1);
  });

  it('genera el cuadrante con un aviso cuando el pool AP excede la capacidad anual', () => {
    const rota = generateRota(YEAR_2026, 'AP', AP_POOL_8, dayClassifications);

    expect(rota.schedule).toHaveLength(365);
    expect(rota.schedule.every((day) => day.doctors.length >= 1)).toBe(true);

    const shortfalls = rota.stats.doctors.map((doctor) =>
      Math.max(0, doctor.targetHours - doctor.totalHours),
    );
    const missingHours = shortfalls.reduce((sum, value) => sum + value, 0);
    const doctorsBelow = shortfalls.filter((value) => value > 0).length;
    // Capacidad 2.942h frente a un objetivo de 8 × 425h = 3.400h.
    expect(missingHours).toBe(3400 - 2942);

    expect(rota.warnings).toHaveLength(1);
    expect(rota.warnings[0]).toMatch(/demasiado grande para AP/);
    expect(rota.warnings[0]).toContain('3400h');
    expect(rota.warnings[0]).toContain('2942h');
    expect(rota.warnings[0]).toContain(`${doctorsBelow} médicos quedan por debajo del mínimo de 425h`);
    expect(rota.warnings[0]).toContain(`faltan ${missingHours}h en total`);
  });

  it('no emite avisos cuando todos los médicos alcanzan el mínimo', () => {
    expect(generateRota(YEAR_2026, 'AP', AP_POOL_5, dayClassifications).warnings).toEqual([]);
    expect(generateRota(YEAR_2026, 'AC', AC_POOL_4, dayClassifications).warnings).toEqual([]);
  });

  it('sigue rechazando un pool demasiado pequeño', () => {
    expect(() => generateRota(YEAR_2026, 'AP', AP_POOL_5.slice(0, 3), dayClassifications)).toThrow(
      /demasiado pequeño/i,
    );
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

    const rota = generateRota(YEAR_2026, 'AC', largePool, dayClassifications);

    for (const day of rota.schedule) {
      expect(day.doctors).toHaveLength(1);
    }
    expect(rota.warnings).toHaveLength(1);
    expect(rota.warnings[0]).toMatch(/demasiado grande para AC/);
    expect(rota.warnings[0]).toContain('8 médicos quedan por debajo del mínimo de 1620h');
    for (const doctor of rota.stats.doctors) {
      expect(doctor.hoursVsTarget).toBeLessThan(0);
    }
  });

  it('mantiene 1 AC primary por día con pool factible', () => {
    const rota = generateRota(YEAR_2026, 'AC', AC_POOL_4, dayClassifications);

    for (const day of rota.schedule) {
      expect(day.doctors).toHaveLength(1);
    }
    expect(rota.doctorsPerDay).toBe(1);
  });
});
