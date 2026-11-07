import { NestFastifyApplication } from '@nestjs/platform-fastify';

import {
  AC_POOL_4,
  AP_POOL_17,
  CITY,
  HOLIDAY_API_RESPONSE,
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

  async function generate(payload: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, ac_pool: AC_POOL_4, ap_pool: AP_POOL_17, ...payload },
    });
  }

  type ApiDay = {
    date: string;
    day_type: string;
    duration_hours: number;
    shift_start: string;
    shift_end: string;
    doctors: { doctor_id: string; doctor_name: string; role: string }[];
  };
  const byDate = (schedule: ApiDay[]) => new Map(schedule.map((day) => [day.date, day]));
  const withRole = (day: ApiDay | undefined, role: string) =>
    (day?.doctors ?? []).filter((doctor) => doctor.role === role);

  it('genera AC y AP con una sola petición', async () => {
    const response = await generate();
    expect(response.statusCode).toBe(201);

    const [ac, ap] = response.json();
    expect(ac).toMatchObject({ year: YEAR_2026, rota_type: 'AC', city: CITY, doctors_per_day: 1 });
    expect(ap).toMatchObject({ year: YEAR_2026, rota_type: 'AP', city: CITY, doctors_per_day: 1 });
    expect(ac.schedule[0].shift_start).toMatch(/^\d{2}:\d{2}$/);
    expect(ac.schedule[0].shift_end).toMatch(/^\d{2}:\d{2}\+1$/);
    expect(ac.schedule).toHaveLength(365);
    expect(ap.schedule).toHaveLength(365);
    expect(ac.stats.doctors).toHaveLength(4);
    expect(ap.stats.doctors).toHaveLength(AP_POOL_17.length);
    expect(ac.warnings).toEqual([]);
    expect(ap.warnings).toEqual([]);

    const allRotas = await app.inject({ method: 'GET', url: '/api/v1/rota/2026' });
    expect(allRotas.json().map((rota: { rota_type: string }) => rota.rota_type)).toEqual(['AC', 'AP']);
  });

  it('cada día devuelve una guardia AC, una guardia AP y sus refuerzos con su papel', async () => {
    const [ac, ap] = (await generate()).json();
    const acDays = byDate(ac.schedule);
    const apDays = byDate(ap.schedule);

    for (const date of acDays.keys()) {
      expect(withRole(acDays.get(date), 'guardia')).toHaveLength(1);
      expect(withRole(apDays.get(date), 'guardia')).toHaveLength(1);
      const refuerzos =
        withRole(acDays.get(date), 'refuerzo').length + withRole(apDays.get(date), 'refuerzo').length;
      expect(refuerzos).toBeGreaterThanOrEqual(1);
      expect(refuerzos).toBeLessThanOrEqual(2);
    }

    // Festivos especiales (aunque la API simulada no traiga el 24 ni el 31) y el domingo 16-08,
    // segundo festivo tras el sábado 15-08: dos refuerzos.
    for (const date of ['2026-01-01', '2026-01-06', '2026-08-16', '2026-12-24', '2026-12-25', '2026-12-31']) {
      const refuerzos =
        withRole(acDays.get(date), 'refuerzo').length + withRole(apDays.get(date), 'refuerzo').length;
      expect(refuerzos).toBe(2);
      expect(acDays.get(date)?.day_type).toBe('holiday');
    }
    expect(withRole(apDays.get('2026-08-15'), 'refuerzo')).toHaveLength(1);

    const holiday = apDays.get('2026-08-16')!;
    expect(holiday.duration_hours).toBe(12);
    expect(holiday.shift_start).toBe('10:00');
    expect(holiday.shift_end).toBe('22:00');
  });

  it('el refuerzo de un AC conserva el horario de la guardia AC del día y suma horas AP', async () => {
    const [ac] = (await generate()).json();
    const day = (ac.schedule as ApiDay[]).find((entry) => withRole(entry, 'refuerzo').length > 0)!;
    expect(day).toBeDefined();
    // El horario del día sigue siendo el de la guardia AC.
    expect(day.shift_start).toBe(day.day_type === 'holiday' ? '09:00' : '15:00');

    const refuerzoDoctor = withRole(day, 'refuerzo')[0].doctor_id;
    const stats = ac.stats.doctors.find((doctor: { doctor_id: string }) => doctor.doctor_id === refuerzoDoctor);
    expect(stats.shifts_refuerzo).toBeGreaterThan(0);

    // Las lecturas posteriores devuelven lo mismo.
    const stored = await app.inject({ method: 'GET', url: '/api/v1/rota/2026/AC' });
    expect(stored.json().stats.doctors).toEqual(ac.stats.doctors);
    expect(byDate(stored.json().schedule).get(day.date)).toEqual(day);
  });

  it('returns 400 for an infeasible pool', async () => {
    const response = await generate({ ac_pool: [{ id: 'doc-001', name: 'Dr. Garcia', department: 'Med' }] });
    expect(response.statusCode).toBe(400);
    expect(typeof response.json().message).toBe('string');
    expect(response.json().message).toMatch(/grupo/i);
  });

  it('rechaza un médico que está en los dos grupos', async () => {
    const response = await generate({ ap_pool: [...AP_POOL_17, AC_POOL_4[0]] });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe(
      'Un médico sólo puede pertenecer a un grupo: doc-001 está en AC y en AP.',
    );
  });

  it('devuelve doctor_order con los mismos médicos de cada grupo y lo conserva al consultar', async () => {
    const response = await generate();
    expect(response.statusCode).toBe(201);
    const [ac, ap] = response.json() as { doctor_order: string[] }[];

    expect([...ac.doctor_order].sort()).toEqual(AC_POOL_4.map((d) => d.id).sort());
    expect([...ap.doctor_order].sort()).toEqual(AP_POOL_17.map((d) => d.id).sort());

    const stored = await app.inject({ method: 'GET', url: `/api/v1/rota/${YEAR_2026}/AC` });
    expect(stored.json().doctor_order).toEqual(ac.doctor_order);
  });

  it('valida el cuerpo con mensajes en español', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: 'x', ac_pool: 'no', ap_pool: 'no' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toEqual([
      'el año debe ser un número entero',
      'el grupo de médicos AC debe ser una lista',
      'cada médico del grupo AC debe ser un objeto válido',
      'el grupo de médicos AP debe ser una lista',
      'cada médico del grupo AP debe ser un objeto válido',
    ]);
  });

  it('genera el cuadrante con avisos y horas faltantes cuando el pool AC es demasiado grande', async () => {
    const oversizedPool = Array.from({ length: 8 }, (_, index) => ({
      id: `doc-overflow-${index}`,
      name: `Doctor ${index}`,
      department: 'Medicina General',
    }));

    const response = await generate({ ac_pool: oversizedPool });
    expect(response.statusCode).toBe(201);

    const [ac] = response.json();
    expect(ac.schedule).toHaveLength(365);
    expect(ac.warnings[0]).toMatch(/demasiado grande para AC/);
    expect(ac.warnings[0]).toMatch(/faltan \d+h en total/);
    expect(ac.warnings[1]).toMatch(/quedan por debajo de 135h en el mes/);
    for (const doctor of ac.stats.doctors) {
      expect(doctor.hours_vs_target).toBeLessThan(0);
    }

    // El cuadrante queda guardado y las horas faltantes siguen en las estadísticas.
    const stored = await app.inject({ method: 'GET', url: '/api/v1/rota/2026/AC' });
    expect(stored.statusCode).toBe(200);
    expect(stored.json().stats.doctors[0].hours_vs_target).toBeLessThan(0);
  });

  it('supports GET rota queries and doctor filtering', async () => {
    expect((await generate()).statusCode).toBe(201);

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

  it('borra los cuadrantes AC y AP del año y conserva los festivos manuales', async () => {
    expect((await generate()).statusCode).toBe(201);
    const manual = await app.inject({
      method: 'POST',
      url: '/api/v1/holidays/2026',
      payload: { date: '2026-03-16', name: 'Festivo Manual' },
    });
    expect(manual.statusCode).toBe(201);

    const response = await app.inject({ method: 'DELETE', url: '/api/v1/rota/2026' });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    for (const url of ['/api/v1/rota/2026', '/api/v1/rota/2026/AC', '/api/v1/rota/2026/AP']) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404);
    }
    const holidays = await app.inject({ method: 'GET', url: '/api/v1/holidays/2026' });
    expect(holidays.json().holidays.map((holiday: { date: string }) => holiday.date)).toContain('2026-03-16');

    // Se puede volver a generar tras el borrado.
    expect((await generate()).statusCode).toBe(201);
  });

  it('devuelve 404 en español al borrar un año sin cuadrantes', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/v1/rota/2035' });
    expect(response.statusCode).toBe(404);
    expect(response.json().message).toBe('No se ha encontrado ningún cuadrante para el año 2035');
  });

  it('sustituir conserva el papel de la asignación', async () => {
    const [ac, ap] = (await generate()).json();

    const acDay = ac.schedule[0];
    const assignedDoctorId = withRole(acDay, 'guardia')[0].doctor_id;
    const replacementDoctor = AC_POOL_4.find(
      (doctor) => !acDay.doctors.some((ref: { doctor_id: string }) => ref.doctor_id === doctor.id),
    )!;

    const replacement = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AC/replace',
      payload: { date: acDay.date, old_doctor_id: assignedDoctorId, new_doctor_id: replacementDoctor.id },
    });
    expect(replacement.statusCode).toBe(200);
    const replacedDay = byDate(replacement.json().schedule).get(acDay.date)!;
    expect(withRole(replacedDay, 'guardia').map((doctor) => doctor.doctor_id)).toEqual([replacementDoctor.id]);

    // En AP, sustituir un refuerzo deja intacta la guardia AP.
    const apDay = (ap.schedule as ApiDay[]).find((day) => day.date === '2026-08-16')!;
    const [guardia] = withRole(apDay, 'guardia');
    const [refuerzo] = withRole(apDay, 'refuerzo');
    const candidate = AP_POOL_17.find(
      (doctor) => !apDay.doctors.some((ref) => ref.doctor_id === doctor.id),
    )!;
    const apReplacement = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AP/replace',
      payload: { date: apDay.date, old_doctor_id: refuerzo.doctor_id, new_doctor_id: candidate.id },
    });
    expect(apReplacement.statusCode).toBe(200);
    const updatedAp = byDate(apReplacement.json().schedule).get(apDay.date)!;
    expect(withRole(updatedAp, 'guardia')).toEqual([guardia]);
    expect(withRole(updatedAp, 'refuerzo').map((doctor) => doctor.doctor_id)).toContain(candidate.id);
    expect(updatedAp.doctors.map((doctor) => doctor.doctor_id)).not.toContain(refuerzo.doctor_id);
  });

  it('sustituye un refuerzo del otro grupo: sale de su cuadrante y entra como refuerzo en el del médico', async () => {
    const [ac, ap] = (await generate()).json();

    // Un día laborable con refuerzo AP en el que el médico AC elegido no tiene asignación.
    const apDay = (ap.schedule as ApiDay[]).find(
      (day) => day.day_type === 'weekday' && withRole(day, 'refuerzo').length === 1,
    )!;
    const [apRefuerzo] = withRole(apDay, 'refuerzo');
    const acDay = byDate(ac.schedule).get(apDay.date)!;
    const acDoctor = AC_POOL_4.find(
      (doctor) => !acDay.doctors.some((ref: { doctor_id: string }) => ref.doctor_id === doctor.id),
    )!;

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AC/replace',
      payload: {
        date: apDay.date,
        old_doctor_id: apRefuerzo.doctor_id,
        new_doctor_id: acDoctor.id,
        old_rota_type: 'AP',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().rota_type).toBe('AC');
    const updatedAc = byDate(response.json().schedule).get(apDay.date)!;
    expect(withRole(updatedAc, 'refuerzo')).toContainEqual(
      expect.objectContaining({ doctor_id: acDoctor.id }),
    );

    const storedAp = (await app.inject({ method: 'GET', url: '/api/v1/rota/2026/AP' })).json();
    const updatedAp = byDate(storedAp.schedule).get(apDay.date)!;
    expect(updatedAp.doctors.map((doctor: { doctor_id: string }) => doctor.doctor_id)).not.toContain(
      apRefuerzo.doctor_id,
    );
    expect(withRole(updatedAp, 'guardia')).toEqual(withRole(apDay, 'guardia'));

    // La guardia del otro grupo no se puede sustituir.
    const [apGuardia] = withRole(apDay, 'guardia');
    const otherAcDoctor = AC_POOL_4.find(
      (doctor) => doctor.id !== acDoctor.id && !acDay.doctors.some((ref: { doctor_id: string }) => ref.doctor_id === doctor.id),
    )!;
    const guardiaAttempt = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AC/replace',
      payload: {
        date: apDay.date,
        old_doctor_id: apGuardia.doctor_id,
        new_doctor_id: otherAcDoctor.id,
        old_rota_type: 'AP',
      },
    });
    expect(guardiaAttempt.statusCode).toBe(400);
    expect(guardiaAttempt.json().message).toMatch(/sólo se puede sustituir un refuerzo/i);

    const invalidType = await app.inject({
      method: 'PATCH',
      url: '/api/v1/rota/2026/AC/replace',
      payload: { date: apDay.date, old_doctor_id: 'x', new_doctor_id: 'y', old_rota_type: 'ZZ' },
    });
    expect(invalidType.statusCode).toBe(400);
    expect(invalidType.json().message).toEqual(['el grupo del médico saliente debe ser AC o AP']);
  });

  it('supports adding a doctor to an existing day', async () => {
    const [ac, ap] = (await generate()).json();

    const targetDay = (ac.schedule as ApiDay[]).find((day) => day.doctors.length === 1)!;
    const assignedDoctorId = targetDay.doctors[0].doctor_id;
    const extraDoctor = AC_POOL_4.find((doctor) => doctor.id !== assignedDoctorId);
    expect(extraDoctor).toBeDefined();

    const hoursOf = (body: { stats: { doctors: { doctor_id: string; total_hours: number }[] } }) =>
      body.stats.doctors.find((doctor) => doctor.doctor_id === extraDoctor!.id)!.total_hours;
    const hoursBefore = hoursOf(ac);

    const addition = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/2026/AC/add',
      payload: { date: targetDay.date, doctor_id: extraDoctor!.id },
    });
    expect(addition.statusCode).toBe(200);

    // En AC también se añade un refuerzo, con el horario AP del día (7h L-S, 12h festivo).
    const updatedDay = byDate(addition.json().schedule).get(targetDay.date)!;
    expect(updatedDay.doctors).toHaveLength(2);
    expect(updatedDay.doctors[0].doctor_id).toBe(assignedDoctorId);
    expect(updatedDay.doctors[1]).toMatchObject({ doctor_id: extraDoctor!.id, role: 'refuerzo' });
    expect(hoursOf(addition.json())).toBe(hoursBefore + (targetDay.day_type === 'holiday' ? 12 : 7));

    // En AP se añade un refuerzo.
    const apDay = ap.schedule[10] as ApiDay;
    const apExtra = AP_POOL_17.find((doctor) => !apDay.doctors.some((ref) => ref.doctor_id === doctor.id))!;
    const apAddition = await app.inject({
      method: 'POST',
      url: '/api/v1/rota/2026/AP/add',
      payload: { date: apDay.date, doctor_id: apExtra.id },
    });
    expect(apAddition.statusCode).toBe(200);
    expect(byDate(apAddition.json().schedule).get(apDay.date)!.doctors).toContainEqual(
      expect.objectContaining({ doctor_id: apExtra.id, role: 'refuerzo' }),
    );

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

  it('cuenta el 31 de diciembre anterior, ahora siempre festivo especial, para el 1 de enero', async () => {
    const [ac, ap] = (await generate()).json();
    const refuerzos =
      withRole(byDate(ac.schedule).get('2026-01-01'), 'refuerzo').length +
      withRole(byDate(ap.schedule).get('2026-01-01'), 'refuerzo').length;
    expect(refuerzos).toBe(2);
  });

  it('aplica turnos AP de 7h en laborables y sábados (15:00–22:00)', async () => {
    const [, ap] = (await generate()).json();

    const nonHoliday = (ap.schedule as ApiDay[]).find(
      (day) => day.day_type === 'weekday' || day.day_type === 'saturday',
    )!;
    expect(nonHoliday.duration_hours).toBe(7);
    expect(nonHoliday.shift_start).toBe('15:00');
    expect(nonHoliday.shift_end).toBe('22:00');
  });

  describe('método de asignación (strategy)', () => {
    it('genera con wheels y lo devuelve en la respuesta y en las lecturas posteriores', async () => {
      const generation = await generate({ strategy: 'wheels' });
      expect(generation.statusCode).toBe(201);
      expect(generation.json().map((rota: { strategy: string }) => rota.strategy)).toEqual(['wheels', 'wheels']);

      const byType = await app.inject({ method: 'GET', url: `/api/v1/rota/${YEAR_2026}/AP` });
      expect(byType.json().strategy).toBe('wheels');

      const byYear = await app.inject({ method: 'GET', url: `/api/v1/rota/${YEAR_2026}` });
      expect(byYear.json()[0].strategy).toBe('wheels');
    });

    it('genera con single-wheel y lo devuelve en la respuesta y en las lecturas posteriores', async () => {
      const generation = await generate({ strategy: 'single-wheel' });
      expect(generation.statusCode).toBe(201);
      expect(generation.json().map((rota: { strategy: string }) => rota.strategy)).toEqual([
        'single-wheel',
        'single-wheel',
      ]);

      const byType = await app.inject({ method: 'GET', url: `/api/v1/rota/${YEAR_2026}/AC` });
      expect(byType.json().strategy).toBe('single-wheel');
    });

    it('usa wheels por defecto', async () => {
      const generation = await generate();
      expect(generation.statusCode).toBe(201);
      expect(generation.json()[0].strategy).toBe('wheels');

      const byType = await app.inject({ method: 'GET', url: `/api/v1/rota/${YEAR_2026}/AC` });
      expect(byType.json().strategy).toBe('wheels');
    });

    it('trata strategy null como omitido y usa wheels', async () => {
      const generation = await generate({ strategy: null });
      expect(generation.statusCode).toBe(201);
      expect(generation.json()[1].strategy).toBe('wheels');
    });

    it.each(['aleatoria', 'balanced'])(
      'rechaza la estrategia %s con el mensaje en español',
      async (strategy) => {
        const response = await generate({ strategy });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toContain(
          'el método de asignación debe ser wheels o single-wheel',
        );
      },
    );
  });

  it('marca los festivos especiales de sanidad y no deja eliminarlos', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/holidays/2026' });
    const specials = response
      .json()
      .holidays.filter((holiday: { special: boolean }) => holiday.special)
      .map((holiday: { date: string }) => holiday.date);
    expect(specials).toEqual(['2026-01-01', '2026-01-06', '2026-12-24', '2026-12-25', '2026-12-31']);

    const deletion = await app.inject({ method: 'DELETE', url: '/api/v1/holidays/2026/2026-12-24' });
    expect(deletion.statusCode).toBe(400);
    expect(deletion.json().message).toBe('Los festivos especiales de sanidad no se pueden eliminar');
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
