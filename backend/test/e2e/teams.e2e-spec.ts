import { NestFastifyApplication } from '@nestjs/platform-fastify';

import { AC_POOL_4, AP_POOL_17, HOLIDAY_API_RESPONSE, YEAR_2026 } from '../helpers/fixtures';
import { createTestApp } from '../helpers/test-app';

const DEFAULT_TEAM_NAME = 'Equipo principal';

const TEAM_DOCTORS = [
  { id: 'doc-001', name: 'Dr. García', department: 'Medicina General', rota_type: 'AC' },
  { id: 'doc-021', name: 'Dr. Navarro', department: 'Urgencias', rota_type: 'AP' },
];

describe('Equipos', () => {
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

  async function listTeams() {
    const response = await app.inject({ method: 'GET', url: '/api/v1/teams' });
    expect(response.statusCode).toBe(200);
    return response.json() as { id: number; name: string; doctors: unknown[] }[];
  }

  async function createTeam(name: string) {
    const response = await app.inject({ method: 'POST', url: '/api/v1/teams', payload: { name } });
    expect(response.statusCode).toBe(201);
    return response.json() as { id: number; name: string; doctors: unknown[] };
  }

  async function generate(teamId?: number) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/rota/generate',
      payload: { year: YEAR_2026, ac_pool: AC_POOL_4, ap_pool: AP_POOL_17, team_id: teamId },
    });
  }

  it('siempre hay al menos un equipo: el equipo principal, sin médicos', async () => {
    const teams = await listTeams();
    expect(teams).toEqual([{ id: expect.any(Number), name: DEFAULT_TEAM_NAME, doctors: [] }]);
  });

  it('crea, renombra y lista equipos por orden de creación', async () => {
    const created = await createTeam('Urgencias Norte');
    expect(created).toEqual({ id: expect.any(Number), name: 'Urgencias Norte', doctors: [] });

    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${created.id}`,
      payload: { name: 'Urgencias Sur' },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().name).toBe('Urgencias Sur');

    expect((await listTeams()).map((team) => team.name)).toEqual([DEFAULT_TEAM_NAME, 'Urgencias Sur']);
  });

  it('rechaza nombres vacíos o repetidos con mensajes en español', async () => {
    const empty = await app.inject({ method: 'POST', url: '/api/v1/teams', payload: { name: '   ' } });
    expect(empty.statusCode).toBe(400);
    expect(empty.json().message).toEqual(['el nombre del equipo no puede estar vacío']);

    const missing = await app.inject({ method: 'POST', url: '/api/v1/teams', payload: {} });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().message).toEqual(['el nombre del equipo no puede estar vacío']);

    const notText = await app.inject({ method: 'POST', url: '/api/v1/teams', payload: { name: ['a'] } });
    expect(notText.statusCode).toBe(400);
    expect(notText.json().message).toContain('el nombre del equipo debe ser una cadena de texto');

    const duplicated = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      payload: { name: ` ${DEFAULT_TEAM_NAME} ` },
    });
    expect(duplicated.statusCode).toBe(400);
    expect(duplicated.json().message).toBe(`Ya existe un equipo llamado «${DEFAULT_TEAM_NAME}».`);
  });

  it('sustituye la lista de médicos de un equipo', async () => {
    const [team] = await listTeams();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/teams/${team.id}/doctors`,
      payload: { doctors: TEAM_DOCTORS },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: team.id, name: DEFAULT_TEAM_NAME, doctors: TEAM_DOCTORS });
    expect((await listTeams())[0].doctors).toEqual(TEAM_DOCTORS);
  });

  it('valida la lista de médicos con mensajes en español', async () => {
    const [team] = await listTeams();
    const put = (doctors: unknown) =>
      app.inject({ method: 'PUT', url: `/api/v1/teams/${team.id}/doctors`, payload: { doctors } });

    const notList = await put('no');
    expect(notList.statusCode).toBe(400);
    expect(notList.json().message).toContain('la lista de médicos debe ser una lista');

    const empty = await put([]);
    expect(empty.statusCode).toBe(400);
    expect(empty.json().message).toContain('la lista de médicos no puede estar vacía');

    const badGroup = await put([{ ...TEAM_DOCTORS[0], rota_type: 'XX' }]);
    expect(badGroup.statusCode).toBe(400);
    expect(badGroup.json().message).toContain('doctors.0.el grupo del médico debe ser AC o AP');

    const duplicated = await put([TEAM_DOCTORS[0], { ...TEAM_DOCTORS[1], id: TEAM_DOCTORS[0].id }]);
    expect(duplicated.statusCode).toBe(400);
    expect(duplicated.json().message).toBe('Hay médicos con el identificador repetido: doc-001.');
  });

  it('devuelve 404 en español para un equipo inexistente', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/teams/999/doctors',
      payload: { doctors: TEAM_DOCTORS },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().message).toBe('No se ha encontrado el equipo 999.');

    const generation = await generate(999);
    expect(generation.statusCode).toBe(404);
    expect(generation.json().message).toBe('No se ha encontrado el equipo 999.');

    const invalid = await app.inject({ method: 'GET', url: '/api/v1/rota/2026?team_id=abc' });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().message).toBe('el equipo debe ser un número entero');
  });

  it('cada equipo tiene sus propios cuadrantes del año', async () => {
    const [main] = await listTeams();
    const other = await createTeam('Urgencias Norte');

    const mainGeneration = await generate(main.id);
    expect(mainGeneration.statusCode).toBe(201);
    expect(mainGeneration.json().map((rota: { team_id: number }) => rota.team_id)).toEqual([main.id, main.id]);

    const otherGeneration = await generate(other.id);
    expect(otherGeneration.statusCode).toBe(201);

    // Sin team_id se usa el equipo principal (el más antiguo).
    const defaultRotas = await app.inject({ method: 'GET', url: '/api/v1/rota/2026' });
    expect(defaultRotas.json().map((rota: { team_id: number }) => rota.team_id)).toEqual([main.id, main.id]);

    const deletion = await app.inject({ method: 'DELETE', url: `/api/v1/rota/2026?team_id=${other.id}` });
    expect(deletion.statusCode).toBe(204);

    const otherRotas = await app.inject({ method: 'GET', url: `/api/v1/rota/2026?team_id=${other.id}` });
    expect(otherRotas.statusCode).toBe(404);
    const mainRotas = await app.inject({ method: 'GET', url: `/api/v1/rota/2026/AC?team_id=${main.id}` });
    expect(mainRotas.statusCode).toBe(200);
    expect(mainRotas.json().team_id).toBe(main.id);
  });

  it('las ediciones de un día sólo afectan al cuadrante del equipo indicado', async () => {
    const [main] = await listTeams();
    const other = await createTeam('Urgencias Norte');
    await generate(main.id);
    await generate(other.id);

    const getAc = async (teamId: number) =>
      (await app.inject({ method: 'GET', url: `/api/v1/rota/2026/AC?team_id=${teamId}` })).json();
    const mainBefore = await getAc(main.id);
    const otherAc = await getAc(other.id);
    const day = otherAc.schedule[10];
    const guardia = day.doctors.find((doctor: { role: string }) => doctor.role === 'guardia');
    const replacement = AC_POOL_4.find((doctor) => !day.doctors.some((d: { doctor_id: string }) => d.doctor_id === doctor.id))!;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/rota/2026/AC/replace?team_id=${other.id}`,
      payload: { date: day.date, old_doctor_id: guardia.doctor_id, new_doctor_id: replacement.id },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().team_id).toBe(other.id);

    const otherAfter = await getAc(other.id);
    expect(otherAfter.schedule[10].doctors.map((d: { doctor_id: string }) => d.doctor_id)).toContain(replacement.id);
    // El cuadrante del otro equipo no cambia.
    expect((await getAc(main.id)).schedule).toEqual(mainBefore.schedule);
  });

  it('al borrar un equipo se borran sus cuadrantes, pero no se puede borrar el último', async () => {
    const [main] = await listTeams();
    const other = await createTeam('Urgencias Norte');
    await generate(other.id);

    const deletion = await app.inject({ method: 'DELETE', url: `/api/v1/teams/${other.id}` });
    expect(deletion.statusCode).toBe(204);
    expect((await listTeams()).map((team) => team.id)).toEqual([main.id]);

    const lastDeletion = await app.inject({ method: 'DELETE', url: `/api/v1/teams/${main.id}` });
    expect(lastDeletion.statusCode).toBe(400);
    expect(lastDeletion.json().message).toBe('No se puede borrar el único equipo.');

    // Un equipo nuevo con el mismo nombre no hereda los cuadrantes del borrado.
    const recreated = await createTeam('Urgencias Norte');
    const rotas = await app.inject({ method: 'GET', url: `/api/v1/rota/2026?team_id=${recreated.id}` });
    expect(rotas.statusCode).toBe(404);
  });
});
