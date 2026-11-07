import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TeamsService } from './teams.service';
import { Team } from '../models/team.model';

describe('TeamsService', () => {
  let service: TeamsService;
  let httpTesting: HttpTestingController;

  const teams: Team[] = [
    { id: 1, name: 'Equipo principal', doctors: [] },
    { id: 2, name: 'Urgencias Norte', doctors: [] },
  ];

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TeamsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  function load() {
    service.load().subscribe();
    httpTesting.expectOne('/api/v1/teams').flush(teams);
  }

  it('carga los equipos y empieza por el primero', () => {
    load();
    expect(service.teams().map((team) => team.name)).toEqual(['Equipo principal', 'Urgencias Norte']);
    expect(service.initialTeamId()).toBe(1);
  });

  it('recuerda el último equipo seleccionado si sigue existiendo', () => {
    service.select(2);
    load();
    expect(service.initialTeamId()).toBe(2);

    localStorage.setItem('rota.selectedTeamId', '99');
    expect(service.initialTeamId()).toBe(1);
  });

  it('crea, renombra y borra equipos manteniendo la lista al día', () => {
    load();
    service.create('Pediatría').subscribe();
    const createReq = httpTesting.expectOne('/api/v1/teams');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({ name: 'Pediatría' });
    createReq.flush({ id: 3, name: 'Pediatría', doctors: [] });

    service.rename(3, 'Pediatría Sur').subscribe();
    const renameReq = httpTesting.expectOne('/api/v1/teams/3');
    expect(renameReq.request.method).toBe('PATCH');
    renameReq.flush({ id: 3, name: 'Pediatría Sur', doctors: [] });

    service.delete(2).subscribe();
    const deleteReq = httpTesting.expectOne('/api/v1/teams/2');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);

    expect(service.teams().map((team) => team.name)).toEqual(['Equipo principal', 'Pediatría Sur']);
  });

  it('sustituye la lista de médicos con PUT y actualiza el equipo seleccionado', () => {
    load();
    service.select(1);
    const doctors = [{ id: 'doc-1', name: 'Dr. A', department: '', rota_type: 'AC' as const }];

    service.setDoctors(1, doctors).subscribe();
    const req = httpTesting.expectOne('/api/v1/teams/1/doctors');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ doctors });
    req.flush({ id: 1, name: 'Equipo principal', doctors });

    expect(service.selectedTeam()?.doctors).toEqual(doctors);
  });
});
