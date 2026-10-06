import { NestFastifyApplication } from '@nestjs/platform-fastify';

import {
  AC_POOL_4,
  AP_POOL_5,
  CITY,
  HOLIDAY_API_RESPONSE,
  YEAR_2026,
} from '../helpers/fixtures';
import { createTestApp } from '../helpers/test-app';
import { HolidaysService } from '../../src/holidays/holidays.service';

describe('HTTP contract', () => {
  let app: NestFastifyApplication;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(async () => {
    process.env.DB_TYPE = 'sqljs';
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => HOLIDAY_API_RESPONSE,
      text: async () => JSON.stringify(HOLIDAY_API_RESPONSE),
    } as Response);
    app = await createTestApp();
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
    if (app) {
      await app.close();
    }
  });

  it('returns health and config payloads', async () => {
    const healthResponse = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({ status: 'ok' });

    const configResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
    });
    expect(configResponse.statusCode).toBe(200);
    expect(configResponse.json()).toEqual({ city: CITY });
  });

  it('generates AC and AP rotas with the expected response shape', async () => {
    const acResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AC', pool: AC_POOL_4 },
    });
    expect(acResponse.statusCode).toBe(201);

    expect(acResponse.json()).toMatchObject({
      year: YEAR_2026,
      rota_type: 'AC',
      city: CITY,
      doctors_per_day: 1,
    });
    expect(acResponse.json().schedule[0].shift_start).toMatch(/^\d{2}:\d{2}$/);
    expect(acResponse.json().schedule[0].shift_end).toMatch(/^\d{2}:\d{2}\+1$/);
    expect(acResponse.json().schedule).toHaveLength(365);
    expect(acResponse.json().stats.doctors).toHaveLength(4);

    const apResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AP', pool: AP_POOL_5 },
    });
    expect(apResponse.statusCode).toBe(201);

    expect(apResponse.json()).toMatchObject({
      year: YEAR_2026,
      rota_type: 'AP',
      doctors_per_day: 1,
    });
    expect(apResponse.json().schedule).toHaveLength(365);
    expect(apResponse.json().stats.doctors).toHaveLength(5);
  });

  it('returns 400 for an infeasible pool', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: {
        year: YEAR_2026,
        rota_type: 'AC',
        pool: [{ id: 'doc-001', name: 'Dr. Garcia', department: 'Med' }],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(typeof response.json().message).toBe('string');
    expect(response.json().message).toMatch(/grupo/i);
  });

  it('genera el cuadrante con un aviso y horas faltantes cuando el pool AC es demasiado grande', async () => {
    const oversizedPool = Array.from({ length: 8 }, (_, index) => ({
      id: `doc-overflow-${index}`,
      name: `Doctor ${index}`,
      department: 'Medicina General',
    }));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AC', pool: oversizedPool },
    });
    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.schedule).toHaveLength(365);
    expect(body.warnings).toHaveLength(1);
    expect(body.warnings[0]).toMatch(/demasiado grande para AC/);
    expect(body.warnings[0]).toMatch(/faltan \d+h en total/);
    for (const doctor of body.stats.doctors) {
      expect(doctor.hours_vs_target).toBeLessThan(0);
    }

    // El cuadrante queda guardado y las horas faltantes siguen en las estadísticas.
    const stored = await app.inject({ method: 'GET', url: '/api/v1/rota/2026/AC' });
    expect(stored.statusCode).toBe(200);
    expect(stored.json().stats.doctors[0].hours_vs_target).toBeLessThan(0);
  });

  it('supports GET rota queries and doctor filtering', async () => {
    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AC', pool: AC_POOL_4 },
    });
    expect(generation.statusCode).toBe(201);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/rota/2026/AC?doctor_id=doc-001',
    });
    expect(response.statusCode).toBe(200);

    expect(response.json().year).toBe(YEAR_2026);
    expect(response.json().rota_type).toBe('AC');
    expect(response.json().schedule.length).toBeGreaterThan(0);
    for (const day of response.json().schedule) {
      expect(day.doctors.map((doctor: { doctor_id: string }) => doctor.doctor_id)).toContain('doc-001');
    }
  });

  it('supports replace flows and list retrievals', async () => {
    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AC', pool: AC_POOL_4 },
    });
    expect(generation.statusCode).toBe(201);

    const targetDay = generation.json().schedule[0];
    const assignedDoctorId = targetDay.doctors[0].doctor_id;
    const replacementDoctor = AC_POOL_4.find((doctor) => doctor.id !== assignedDoctorId);
    expect(replacementDoctor).toBeDefined();

    const replacement = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AC/replace',
      payload: {
        date: targetDay.date,
        old_doctor_id: assignedDoctorId,
        new_doctor_id: replacementDoctor!.id,
      },
    });
    expect(replacement.statusCode).toBe(200);

    const replacedDay = replacement
      .json()
      .schedule.find((day: { date: string }) => day.date === targetDay.date);
    expect(replacedDay.doctors).toHaveLength(1);
    expect(replacedDay.doctors[0].doctor_id).toBe(replacementDoctor!.id);

    const allRotas = await app.inject({
      method: 'GET',
      url: '/api/v1/rota/2026',
    });
    expect(allRotas.statusCode).toBe(200);
    expect(allRotas.json()).toHaveLength(1);
    expect(allRotas.json()[0].rota_type).toBe('AC');
  });

  it('supports adding a doctor to an existing day', async () => {
    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AC', pool: AC_POOL_4 },
    });
    expect(generation.statusCode).toBe(201);

    const targetDay = generation.json().schedule[0];
    const assignedDoctorId = targetDay.doctors[0].doctor_id;
    const extraDoctor = AC_POOL_4.find((doctor) => doctor.id !== assignedDoctorId);
    expect(extraDoctor).toBeDefined();

    const hoursOf = (body: { stats: { doctors: { doctor_id: string; total_hours: number }[] } }) =>
      body.stats.doctors.find((doctor) => doctor.doctor_id === extraDoctor!.id)!.total_hours;
    const hoursBefore = hoursOf(generation.json());

    const addition = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/2026/AC/add',
      payload: { date: targetDay.date, doctor_id: extraDoctor!.id },
    });
    expect(addition.statusCode).toBe(200);

    const updatedDay = addition
      .json()
      .schedule.find((day: { date: string }) => day.date === targetDay.date);
    expect(updatedDay.doctors).toHaveLength(2);
    expect(updatedDay.doctors[0].doctor_id).toBe(assignedDoctorId);
    expect(updatedDay.doctors[1].doctor_id).toBe(extraDoctor!.id);
    expect(hoursOf(addition.json())).toBe(hoursBefore + targetDay.duration_hours);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/2026/AC/add',
      payload: { date: targetDay.date, doctor_id: extraDoctor!.id },
    });
    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.json().message).toMatch(/ya tiene una asignación/i);

    const outsider = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/2026/AC/add',
      payload: { date: targetDay.date, doctor_id: 'doc-fuera-del-grupo' },
    });
    expect(outsider.statusCode).toBe(400);
    expect(outsider.json().message).toMatch(/no pertenece al grupo/i);

    const missingRota = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/2035/AC/add',
      payload: { date: '2035-01-01', doctor_id: extraDoctor!.id },
    });
    expect(missingRota.statusCode).toBe(404);

    const invalidBody = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/2026/AC/add',
      payload: { date: 'x' },
    });
    expect(invalidBody.statusCode).toBe(400);
    expect(invalidBody.json().message).toEqual([
      'la fecha debe ser una fecha válida con formato AAAA-MM-DD',
      'el identificador del médico debe ser una cadena de texto',
    ]);
  });

  it('keeps AC and AP rotas independent for the same year', async () => {
    const acGeneration = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AC', pool: AC_POOL_4 },
    });
    expect(acGeneration.statusCode).toBe(201);

    const apGeneration = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AP', pool: AP_POOL_5 },
    });
    expect(apGeneration.statusCode).toBe(201);

    const allRotas = await app.inject({
      method: 'GET',
      url: '/api/v1/rota/2026',
    });
    expect(allRotas.statusCode).toBe(200);
    expect(allRotas.json()).toHaveLength(2);
    expect(new Set(allRotas.json().map((rota: { rota_type: string }) => rota.rota_type))).toEqual(
      new Set(['AC', 'AP']),
    );
  });

  it('asigna dos primarios AP en el segundo festivo consecutivo y permite reemplazar uno sin tocar al otro', async () => {
    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AP', pool: AP_POOL_5 },
    });
    expect(generation.statusCode).toBe(201);

    const schedule: Array<{ date: string; day_type: string; doctors: unknown[] }> =
      generation.json().schedule;

    // Con los festivos simulados, sólo el domingo 16-08 sigue a otro festivo (sábado 15-08).
    expect(schedule.filter((day) => day.doctors.length === 2).map((day) => day.date)).toEqual([
      '2026-08-16',
    ]);
    expect(schedule.find((day) => day.date === '2026-08-15')?.doctors).toHaveLength(1);

    const holidayDay = generation
      .json()
      .schedule.find((day: { date: string }) => day.date === '2026-08-16');
    expect(holidayDay).toBeDefined();
    expect(holidayDay.day_type).toBe('holiday');
    expect(holidayDay.doctors).toHaveLength(2);
    expect(holidayDay.duration_hours).toBe(12);
    expect(holidayDay.shift_start).toBe('10:00');
    expect(holidayDay.shift_end).toBe('22:00');

    const [firstAp, secondAp] = holidayDay.doctors;
    const replacementCandidate = AP_POOL_5.find(
      (doctor) => doctor.id !== firstAp.doctor_id && doctor.id !== secondAp.doctor_id,
    );
    expect(replacementCandidate).toBeDefined();

    const replacement = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AP/replace',
      payload: {
        date: holidayDay.date,
        old_doctor_id: firstAp.doctor_id,
        new_doctor_id: replacementCandidate!.id,
      },
    });
    expect(replacement.statusCode).toBe(200);

    const replacedDay = replacement
      .json()
      .schedule.find((day: { date: string }) => day.date === holidayDay.date);
    const updatedDoctorIds = replacedDay.doctors.map(
      (doctor: { doctor_id: string }) => doctor.doctor_id,
    );
    expect(updatedDoctorIds).toContain(replacementCandidate!.id);
    expect(updatedDoctorIds).toContain(secondAp.doctor_id);
    expect(updatedDoctorIds).not.toContain(firstAp.doctor_id);
  });

  it('asigna dos AP el 1 de enero cuando el 31 de diciembre anterior es festivo manual', async () => {
    // El 31-12-2025 es miércoles: sólo es festivo porque se marca a mano en el año anterior.
    await app.get(HolidaysService).createCustomHoliday(2025, CITY, '2025-12-31', 'Festivo Manual');

    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AP', pool: AP_POOL_5 },
    });
    expect(generation.statusCode).toBe(201);

    const newYear = generation
      .json()
      .schedule.find((day: { date: string }) => day.date === '2026-01-01');
    expect(newYear.day_type).toBe('holiday');
    expect(newYear.doctors).toHaveLength(2);
  });

  it('aplica turnos AP de 7h en laborables y sábados (15:00–22:00)', async () => {
    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AP', pool: AP_POOL_5 },
    });
    expect(generation.statusCode).toBe(201);

    const nonHoliday = generation
      .json()
      .schedule.find(
        (day: { day_type: string }) => day.day_type === 'weekday' || day.day_type === 'saturday',
      );
    expect(nonHoliday).toBeDefined();
    expect(nonHoliday.duration_hours).toBe(7);
    expect(nonHoliday.shift_start).toBe('15:00');
    expect(nonHoliday.shift_end).toBe('22:00');
  });

  it('returns holidays for the configured city', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/holidays/2026',
    });
    expect(response.statusCode).toBe(200);

    expect(response.json().year).toBe(YEAR_2026);
    expect(response.json().city).toBe(CITY);
    expect(response.json().holidays).toBeInstanceOf(Array);
    expect(response.json().holidays.length).toBeGreaterThan(0);
  });
});
