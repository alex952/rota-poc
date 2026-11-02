import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RotaService } from './rota.service';
import { AddDoctorRequest, RotaResponse, ReplaceRequest } from '../models/rota.model';
import { Doctor } from '../models/doctor.model';

describe('RotaService', () => {
  let service: RotaService;
  let httpTesting: HttpTestingController;

  const mockRotaResponse: RotaResponse = {
    year: 2026,
    city: 'Madrid',
    rota_type: 'AC',
    doctors_per_day: 1,
    generated_at: '2026-01-15T10:30:00Z',
    schedule: [
      {
        date: '2026-01-01',
        day_type: 'holiday',
        shift_start: '09:00',
        shift_end: '08:00+1',
        duration_hours: 23,
        doctors: [{ doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' }],
      },
    ],
    stats: {
      doctors: [
        {
          doctor_id: 'doc-001',
          doctor_name: 'Dr. Garcia',
          total_hours: 1650,
          monthly_hours: { 1: 140, 2: 130 },
          shifts_weekday: 20,
          shifts_saturday: 5,
          shifts_sunday_holiday: 4,
        },
      ],
    },
    warnings: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RotaService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch rota for year and type via GET /api/v1/rota/{year}/{type}', () => {
    service.getRota(2026, 'AC').subscribe((rota) => {
      expect(rota.year).toBe(2026);
      expect(rota.rota_type).toBe('AC');
      expect(rota.schedule.length).toBe(1);
    });

    const req = httpTesting.expectOne('/api/v1/rota/2026/AC');
    expect(req.request.method).toBe('GET');
    req.flush(mockRotaResponse);
  });

  it('should fetch all rotas for year via GET /api/v1/rota/{year}', () => {
    service.getRotas(2026).subscribe((rotas) => {
      expect(rotas.length).toBe(1);
    });

    const req = httpTesting.expectOne('/api/v1/rota/2026');
    expect(req.request.method).toBe('GET');
    req.flush([mockRotaResponse]);
  });

  it('should return null/handle 404 when no rota exists', () => {
    service.getRota(2025, 'AC').subscribe({
      next: () => { throw new Error('should have errored'); },
      error: (err) => {
        expect(err.status).toBe(404);
      },
    });

    const req = httpTesting.expectOne('/api/v1/rota/2025/AC');
    expect(req.request.method).toBe('GET');
    req.flush({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' });
  });

  it('should generate rota via POST /api/v1/rota/generate with rota_type', () => {
    const pool: Doctor[] = [
      { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General', rota_type: 'AC' },
      { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria', rota_type: 'AC' },
    ];

    service.generateRota(2026, 'AC', pool).subscribe((rota) => {
      expect(rota.year).toBe(2026);
      expect(rota.rota_type).toBe('AC');
    });

    const req = httpTesting.expectOne('/api/v1/rota/generate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.rota_type).toBe('AC');
    expect(req.request.body.pool).toEqual([
      { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General' },
      { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria' },
    ]);
    req.flush(mockRotaResponse);
  });

  it('debe enviar la estrategia elegida en el POST de generación', () => {
    const pool: Doctor[] = [
      { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General', rota_type: 'AC' },
    ];

    service.generateRota(2026, 'AC', pool, 'wheels').subscribe();

    const req = httpTesting.expectOne('/api/v1/rota/generate');
    expect(req.request.body.strategy).toBe('wheels');
    req.flush(mockRotaResponse);
  });

  it('debe enviar la estrategia balanced por defecto en el POST de generación', () => {
    service.generateRota(2026, 'AC', []).subscribe();

    const req = httpTesting.expectOne('/api/v1/rota/generate');
    expect(req.request.body.strategy).toBe('balanced');
    req.flush(mockRotaResponse);
  });

  it('should replace doctor via PATCH /api/v1/rota/{year}/{type}/replace', () => {
    const replaceRequest: ReplaceRequest = {
      date: '2026-03-15',
      old_doctor_id: 'doc-001',
      new_doctor_id: 'doc-003',
    };

    service.replaceDoctor(2026, 'AC', replaceRequest).subscribe((rota) => {
      expect(rota).toBeTruthy();
    });

    const req = httpTesting.expectOne('/api/v1/rota/2026/AC/replace');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(replaceRequest);
    req.flush(mockRotaResponse);
  });

  it('should add doctor via POST /api/v1/rota/{year}/{type}/add', () => {
    const addRequest: AddDoctorRequest = { date: '2026-03-15', doctor_id: 'doc-003' };

    service.addDoctor(2026, 'AC', addRequest).subscribe((rota) => {
      expect(rota).toBeTruthy();
    });

    const req = httpTesting.expectOne('/api/v1/rota/2026/AC/add');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(addRequest);
    req.flush(mockRotaResponse);
  });

  it('should filter rota by doctor_id query param', () => {
    service.getRotaByDoctor(2026, 'AC', 'doc-001').subscribe((rota) => {
      expect(rota).toBeTruthy();
    });

    const req = httpTesting.expectOne(
      (r) => r.url === '/api/v1/rota/2026/AC' && r.params.get('doctor_id') === 'doc-001'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockRotaResponse);
  });

  it('should export rotas via GET /api/v1/rota/{year}/export with blob response type', () => {
    const blob = new Blob(['xlsx'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    service.exportRotas(2026).subscribe((result) => {
      expect(result).toBeInstanceOf(Blob);
    });

    const req = httpTesting.expectOne('/api/v1/rota/2026/export');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(blob);
  });
});
