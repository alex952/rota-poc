import { NestFastifyApplication } from '@nestjs/platform-fastify';

import {
  AC_POOL_4,
  AP_POOL_5,
  CITY,
  HOLIDAY_API_RESPONSE,
  REDUCED_AC_POOL_4,
  YEAR_2026,
} from '../helpers/fixtures';
import { createTestApp } from '../helpers/test-app';

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
      payload: { year: YEAR_2026, rota_type: 'AC', pool: REDUCED_AC_POOL_4 },
    });
    expect(generation.statusCode).toBe(201);

    const dayWithRefuerzo = generation
      .json()
      .schedule.find((day: { refuerzos: unknown[] }) => day.refuerzos.length > 0);
    expect(dayWithRefuerzo).toBeDefined();

    const replacement = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AC/replace',
      payload: {
        date: dayWithRefuerzo.date,
        old_doctor_id: dayWithRefuerzo.refuerzos[0].doctor_id,
        new_doctor_id: 'doc-002',
        assignment_kind: 'refuerzo',
      },
    });
    expect(replacement.statusCode).toBe(200);

    const replacedDay = replacement
      .json()
      .schedule.find((day: { date: string }) => day.date === dayWithRefuerzo.date);
    expect(replacedDay.refuerzos[0].doctor_id).toBe('doc-002');
    expect(replacedDay.refuerzos[0].shift_end).toMatch(/^\d{2}:\d{2}$/);

    const allRotas = await app.inject({
      method: 'GET',
      url: '/api/v1/rota/2026',
    });
    expect(allRotas.statusCode).toBe(200);
    expect(allRotas.json()).toHaveLength(1);
    expect(allRotas.json()[0].rota_type).toBe('AC');
  });

  it('automatically assigns a refuerzo after replacing in a reduced-hours primary', async () => {
    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AC', pool: REDUCED_AC_POOL_4 },
    });
    expect(generation.statusCode).toBe(201);

    const targetDay = generation
      .json()
      .schedule.find(
        (day: {
          doctors: Array<{ doctor_id: string }>;
          refuerzos: unknown[];
        }) => day.refuerzos.length === 0 && day.doctors[0].doctor_id !== 'doc-001',
      );
    expect(targetDay).toBeDefined();

    const replacePrimary = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AC/replace',
      payload: {
        date: targetDay.date,
        old_doctor_id: targetDay.doctors[0].doctor_id,
        new_doctor_id: 'doc-001',
      },
    });
    expect(replacePrimary.statusCode).toBe(200);

    const replacedDay = replacePrimary
      .json()
      .schedule.find((day: { date: string }) => day.date === targetDay.date);
    expect(replacedDay.doctors[0].doctor_id).toBe('doc-001');
    expect(replacedDay.refuerzos).toHaveLength(1);
    expect(replacedDay.refuerzos[0].linked_primary_doctor_id).toBe('doc-001');
    expect(replacedDay.refuerzos[0].doctor_id).not.toBe('doc-001');
    expect(replacePrimary.json().warnings).toHaveLength(0);
  });

  it('removes linked refuerzo when replacing a reduced-hours primary with a full-time doctor', async () => {
    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AC', pool: REDUCED_AC_POOL_4 },
    });
    expect(generation.statusCode).toBe(201);

    const dayWithRefuerzo = generation
      .json()
      .schedule.find((day: { refuerzos: unknown[] }) => day.refuerzos.length > 0);
    expect(dayWithRefuerzo).toBeDefined();

    const usedIds = new Set([
      ...dayWithRefuerzo.doctors.map((doctor: { doctor_id: string }) => doctor.doctor_id),
      ...dayWithRefuerzo.refuerzos.map((refuerzo: { doctor_id: string }) => refuerzo.doctor_id),
    ]);
    const replacementDoctor = REDUCED_AC_POOL_4.find(
      (doctor) =>
        (doctor.hours_reduced_per_day ?? 0) === 0 && !usedIds.has(doctor.id),
    );
    expect(replacementDoctor).toBeDefined();
    const replacementDoctorId = replacementDoctor!.id;

    const replacement = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AC/replace',
      payload: {
        date: dayWithRefuerzo.date,
        old_doctor_id: dayWithRefuerzo.doctors[0].doctor_id,
        new_doctor_id: replacementDoctorId,
      },
    });
    expect(replacement.statusCode).toBe(200);

    const replacedDay = replacement
      .json()
      .schedule.find((day: { date: string }) => day.date === dayWithRefuerzo.date);
    expect(replacedDay.doctors[0].doctor_id).toBe(replacementDoctorId);
    expect(replacedDay.refuerzos).toHaveLength(0);
  });

  it('allows promoting the current refuerzo to primary when replacing a reduced-hours doctor', async () => {
    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AC', pool: REDUCED_AC_POOL_4 },
    });
    expect(generation.statusCode).toBe(201);

    const dayWithRefuerzo = generation
      .json()
      .schedule.find((day: { refuerzos: unknown[] }) => day.refuerzos.length > 0);
    expect(dayWithRefuerzo).toBeDefined();

    const currentRefuerzoDoctorId = dayWithRefuerzo.refuerzos[0].doctor_id;

    const replacement = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AC/replace',
      payload: {
        date: dayWithRefuerzo.date,
        old_doctor_id: dayWithRefuerzo.doctors[0].doctor_id,
        new_doctor_id: currentRefuerzoDoctorId,
      },
    });
    expect(replacement.statusCode).toBe(200);

    const replacedDay = replacement
      .json()
      .schedule.find((day: { date: string }) => day.date === dayWithRefuerzo.date);
    expect(replacedDay.doctors[0].doctor_id).toBe(currentRefuerzoDoctorId);
    expect(replacedDay.refuerzos).toHaveLength(0);
  });

  it('rejects reduced-hours doctors as refuerzo replacements', async () => {
    const doubleReducedPool = [
      { ...REDUCED_AC_POOL_4[0] },
      { ...REDUCED_AC_POOL_4[1], hours_reduced_per_day: 2 },
      ...REDUCED_AC_POOL_4.slice(2),
    ];

    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, rota_type: 'AC', pool: doubleReducedPool },
    });
    expect(generation.statusCode).toBe(201);

    const dayWithRefuerzo = generation
      .json()
      .schedule.find((day: { refuerzos: unknown[] }) => day.refuerzos.length > 0);
    expect(dayWithRefuerzo).toBeDefined();

    const usedIds = new Set([
      ...dayWithRefuerzo.doctors.map((doctor: { doctor_id: string }) => doctor.doctor_id),
      ...dayWithRefuerzo.refuerzos.map((refuerzo: { doctor_id: string }) => refuerzo.doctor_id),
    ]);
    const reducedReplacement = doubleReducedPool.find(
      (doctor) =>
        (doctor.hours_reduced_per_day ?? 0) > 0 && !usedIds.has(doctor.id),
    );
    expect(reducedReplacement).toBeDefined();
    const reducedReplacementId = reducedReplacement!.id;

    const replacement = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AC/replace',
      payload: {
        date: dayWithRefuerzo.date,
        old_doctor_id: dayWithRefuerzo.refuerzos[0].doctor_id,
        new_doctor_id: reducedReplacementId,
        assignment_kind: 'refuerzo',
      },
    });
    expect(replacement.statusCode).toBe(400);
    expect(replacement.json().message).toContain(
      'Reduced-hours doctors cannot cover refuerzo assignments.',
    );
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
