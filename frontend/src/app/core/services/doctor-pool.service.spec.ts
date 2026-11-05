import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DoctorPoolService } from './doctor-pool.service';
import { Doctor } from '../models/doctor.model';

describe('DoctorPoolService', () => {
  let service: DoctorPoolService;
  let httpTesting: HttpTestingController;

  const mockDoctors: Doctor[] = [
    { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General', rota_type: 'AC' },
    { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria', rota_type: 'AC' },
    { id: 'doc-011', name: 'Dr. Navarro', department: 'Urologia', rota_type: 'AP' },
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

  it('reordena el grupo indicado sin tocar el otro', () => {
    service.loadDoctors();
    httpTesting.expectOne('assets/doctors.json').flush(mockDoctors);

    service.applyOrder('AC', ['doc-002', 'doc-001']);

    expect(service.doctors().map((d) => d.id)).toEqual(['doc-002', 'doc-001', 'doc-011']);
  });

  it('aplica el orden guardado si los médicos se cargan después', () => {
    service.applyOrder('AC', ['doc-002', 'doc-001']);

    service.loadDoctors();
    httpTesting.expectOne('assets/doctors.json').flush(mockDoctors);

    expect(service.getDoctorsByType('AC').map((d) => d.id)).toEqual(['doc-002', 'doc-001']);
  });

  it('deja al final los médicos que no figuran en el orden', () => {
    service.loadDoctors();
    httpTesting.expectOne('assets/doctors.json').flush(mockDoctors);

    service.applyOrder('AC', ['doc-002']);

    expect(service.getDoctorsByType('AC').map((d) => d.id)).toEqual(['doc-002', 'doc-001']);
  });

  it('should add a doctor to the pool', () => {
    service.loadDoctors();
    const req = httpTesting.expectOne('assets/doctors.json');
    req.flush(mockDoctors);

    const newDoctor: Doctor = {
      id: 'doc-004',
      name: 'Dr. Fernandez',
      department: 'Neurologia',
      rota_type: 'AC',
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
    expect(doctors.map((d) => d.id)).toEqual(['doc-001', 'doc-002', 'doc-011']);
  });

  it('should return AC doctors via computed signal', () => {
    service.loadDoctors();
    const req = httpTesting.expectOne('assets/doctors.json');
    req.flush(mockDoctors);

    const acDoctors = service.acDoctors();
    expect(acDoctors.length).toBe(2);
    expect(acDoctors.every(d => d.rota_type === 'AC')).toBe(true);
  });

  it('should return AP doctors via computed signal', () => {
    service.loadDoctors();
    const req = httpTesting.expectOne('assets/doctors.json');
    req.flush(mockDoctors);

    const apDoctors = service.apDoctors();
    expect(apDoctors.length).toBe(1);
    expect(apDoctors[0].rota_type).toBe('AP');
  });

  it('should get doctors by type', () => {
    service.loadDoctors();
    const req = httpTesting.expectOne('assets/doctors.json');
    req.flush(mockDoctors);

    const acDoctors = service.getDoctorsByType('AC');
    expect(acDoctors.length).toBe(2);

    const apDoctors = service.getDoctorsByType('AP');
    expect(apDoctors.length).toBe(1);
  });
});
