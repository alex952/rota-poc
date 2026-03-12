import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DoctorPoolService } from './doctor-pool.service';
import { Doctor } from '../models/doctor.model';

describe('DoctorPoolService', () => {
  let service: DoctorPoolService;
  let httpTesting: HttpTestingController;

  const mockDoctors: Doctor[] = [
    { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General' },
    { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria' },
    { id: 'doc-003', name: 'Dr. Martinez', department: 'Cardiologia' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DoctorPoolService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should load doctors from assets/doctors.json', () => {
    service.loadDoctors();

    const req = httpTesting.expectOne('assets/doctors.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockDoctors);

    expect(service.doctors().length).toBe(3);
    expect(service.doctors()[0].name).toBe('Dr. Garcia');
  });

  it('should add a doctor to the pool', () => {
    service.loadDoctors();
    const req = httpTesting.expectOne('assets/doctors.json');
    req.flush(mockDoctors);

    const newDoctor: Doctor = {
      id: 'doc-004',
      name: 'Dr. Fernandez',
      department: 'Neurologia',
    };

    service.addDoctor(newDoctor);

    expect(service.doctors().length).toBe(4);
    expect(service.doctors()[3].name).toBe('Dr. Fernandez');
  });

  it('should return current pool', () => {
    service.loadDoctors();
    const req = httpTesting.expectOne('assets/doctors.json');
    req.flush(mockDoctors);

    const doctors = service.doctors();
    expect(doctors.length).toBe(3);
    expect(doctors.map((d) => d.id)).toEqual(['doc-001', 'doc-002', 'doc-003']);
  });
});
