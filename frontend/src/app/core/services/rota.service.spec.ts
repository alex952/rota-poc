import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RotaService } from './rota.service';
import { RotaResponse, ReplaceRequest } from '../models/rota.model';
import { Doctor } from '../models/doctor.model';

describe('RotaService', () => {
  let service: RotaService;
  let httpTesting: HttpTestingController;

  const mockRotaResponse: RotaResponse = {
    year: 2026,
    city: 'Madrid',
    generated_at: '2026-01-15T10:30:00Z',
    schedule: [
      {
        date: '2026-01-01',
        day_type: 'holiday',
        shift_start: '09:00',
        shift_end: '08:00+1',
        duration_hours: 23,
        atencion_continuada: { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' },
        atencion_primaria: { doctor_id: 'doc-002', doctor_name: 'Dr. Lopez' },
      },
    ],
    stats: {
      doctors: [
        {
          doctor_id: 'doc-001',
          doctor_name: 'Dr. Garcia',
          total_hours: 572,
          ac_hours: 140,
          ap_hours: 432,
          shifts_weekday: 20,
          shifts_saturday: 5,
          shifts_sunday_holiday: 4,
        },
      ],
    },
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

  it('should fetch rota for year via GET /api/v1/rota/{year}', () => {
    service.getRota(2026).subscribe((rota) => {
      expect(rota.year).toBe(2026);
      expect(rota.city).toBe('Madrid');
      expect(rota.schedule.length).toBe(1);
    });

    const req = httpTesting.expectOne('/api/v1/rota/2026');
    expect(req.request.method).toBe('GET');
    req.flush(mockRotaResponse);
  });

  it('should return null/handle 404 when no rota exists', () => {
    service.getRota(2025).subscribe({
      next: () => { throw new Error('should have errored'); },
      error: (err) => {
        expect(err.status).toBe(404);
      },
    });

    const req = httpTesting.expectOne('/api/v1/rota/2025');
    expect(req.request.method).toBe('GET');
    req.flush({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' });
  });

  it('should generate rota via POST /api/v1/rota/generate', () => {
    const pool: Doctor[] = [
      { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General' },
      { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria' },
    ];

    service.generateRota(2026, pool).subscribe((rota) => {
      expect(rota.year).toBe(2026);
      expect(rota.schedule.length).toBeGreaterThan(0);
    });

    const req = httpTesting.expectOne('/api/v1/rota/generate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ year: 2026, pool });
    req.flush(mockRotaResponse);
  });

  it('should replace doctor via PATCH /api/v1/rota/{year}/replace', () => {
    const replaceRequest: ReplaceRequest = {
      date: '2026-03-15',
      service_type: 'atencion_continuada',
      old_doctor_id: 'doc-001',
      new_doctor_id: 'doc-003',
    };

    service.replaceDoctor(2026, replaceRequest).subscribe((rota) => {
      expect(rota).toBeTruthy();
    });

    const req = httpTesting.expectOne('/api/v1/rota/2026/replace');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(replaceRequest);
    req.flush(mockRotaResponse);
  });

  it('should filter rota by doctor_id query param', () => {
    service.getRotaByDoctor(2026, 'doc-001').subscribe((rota) => {
      expect(rota).toBeTruthy();
    });

    const req = httpTesting.expectOne(
      (r) => r.url === '/api/v1/rota/2026' && r.params.get('doctor_id') === 'doc-001'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockRotaResponse);
  });
});
