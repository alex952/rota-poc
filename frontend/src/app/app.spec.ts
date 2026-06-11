import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { App } from './app';
import { RotaResponse } from './core/models/rota.model';
import { Doctor } from './core/models/doctor.model';
import { NotificationService } from './core/services/notification.service';
import { ReplacementEvent } from './features/calendar/day-cell.component';

const mockDoctors: Doctor[] = [
  { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General', rota_type: 'AC' },
  { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria', rota_type: 'AC' },
  { id: 'doc-011', name: 'Dr. Navarro', department: 'Urologia', rota_type: 'AP' },
];

const mockAcRotaResponse: RotaResponse = {
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
      {
        doctor_id: 'doc-002',
        doctor_name: 'Dr. Lopez',
        total_hours: 1640,
        monthly_hours: { 1: 138, 2: 132 },
        shifts_weekday: 19,
        shifts_saturday: 5,
        shifts_sunday_holiday: 5,
      },
    ],
  },
  warnings: [],
};

describe('App', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function flushInitRequests(options?: {
    rotaStatus?: number;
    city?: string;
    doctors?: Doctor[];
    rotas?: RotaResponse[] | null;
  }) {
    const city = options?.city ?? 'Madrid';
    const doctors = options?.doctors ?? mockDoctors;
    const rotaStatus = options?.rotaStatus ?? 200;
    const rotas = options?.rotas ?? [mockAcRotaResponse];

    const configReq = httpTesting.expectOne('/api/v1/config');
    configReq.flush({ city });

    const doctorsReq = httpTesting.expectOne('assets/doctors.json');
    doctorsReq.flush(doctors);

    const currentYear = new Date().getFullYear();
    const rotaReq = httpTesting.expectOne(`/api/v1/rota/${currentYear}`);
    if (rotaStatus === 200 && rotas) {
      rotaReq.flush(rotas);
    } else {
      rotaReq.flush({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' });
    }

    const holidaysReq = httpTesting.expectOne(`/api/v1/holidays/${currentYear}`);
    holidaysReq.flush({ year: currentYear, city, holidays: [] });
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load city and display it on init', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ city: 'Barcelona', rotaStatus: 404 });
    fixture.detectChanges();

    const cityEl = fixture.nativeElement.querySelector('.city-label');
    expect(cityEl.textContent).toContain('Barcelona');
  });

  it('should load rotas on init and populate calendar', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 200, rotas: [mockAcRotaResponse] });
    fixture.detectChanges();

    const app = fixture.componentInstance;
    expect(app['acSchedule']()).toEqual(mockAcRotaResponse.schedule);
    expect(app['acStats']()).toEqual(mockAcRotaResponse.stats.doctors);
    expect(app['hasAcRota']()).toBe(true);
  });

  it('should default to AC pool tab', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    expect(fixture.componentInstance['activePoolTab']()).toBe('AC');
  });

  it('should show Generate AC Rota when no AC rota exists', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    const generateBtn = fixture.nativeElement.querySelector('.btn-generate');
    expect(generateBtn.textContent).toContain('Generate AC Rota');
  });

  it('should show Re-generate AC Rota when AC rota exists', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 200, rotas: [mockAcRotaResponse] });
    fixture.detectChanges();

    const generateBtn = fixture.nativeElement.querySelector('.btn-generate');
    expect(generateBtn.textContent).toContain('Re-generate AC Rota');
  });

  it('should call generateRota with rota_type when generate button clicked (no existing rota)', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    const generateBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    generateBtn.click();
    fixture.detectChanges();

    const genReq = httpTesting.expectOne('/api/v1/rota/generate');
    expect(genReq.request.method).toBe('POST');
    expect(genReq.request.body.rota_type).toBe('AC');
    expect(genReq.request.body.pool.length).toBe(2); // only AC doctors
    genReq.flush(mockAcRotaResponse);
    fixture.detectChanges();

    expect(fixture.componentInstance['hasAcRota']()).toBe(true);
  });

  it('should show confirm dialog when re-generating', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 200, rotas: [mockAcRotaResponse] });
    fixture.detectChanges();

    const generateBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    generateBtn.click();
    fixture.detectChanges();

    const confirmDialog = fixture.nativeElement.querySelector('.confirm-dialog-backdrop');
    expect(confirmDialog).toBeTruthy();

    const confirmBtn = confirmDialog.querySelector('.btn-confirm');
    confirmBtn.click();
    fixture.detectChanges();

    const genReq = httpTesting.expectOne('/api/v1/rota/generate');
    expect(genReq.request.method).toBe('POST');
    genReq.flush(mockAcRotaResponse);
    fixture.detectChanges();

    const dialogAfter = fixture.nativeElement.querySelector('.confirm-dialog-backdrop');
    expect(dialogAfter).toBeFalsy();
  });

  it('should reload rotas when year changes', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 200, rotas: [mockAcRotaResponse] });
    fixture.detectChanges();

    const yearInput: HTMLInputElement = fixture.nativeElement.querySelector('.year-input');
    yearInput.value = '2025';
    yearInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const rotaReq = httpTesting.expectOne('/api/v1/rota/2025');
    expect(rotaReq.request.method).toBe('GET');
    rotaReq.flush({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' });

    const holidaysReq = httpTesting.expectOne('/api/v1/holidays/2025');
    holidaysReq.flush({ year: 2025, city: 'Madrid', holidays: [] });
    fixture.detectChanges();

    expect(fixture.componentInstance['hasAcRota']()).toBe(false);
    expect(fixture.componentInstance['acSchedule']()).toEqual([]);
  });

  it('should show loading spinner during rota generation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    const generateBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    generateBtn.click();
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector('.loading-overlay');
    expect(overlay).toBeTruthy();

    const spinner = fixture.nativeElement.querySelector('.spinner');
    expect(spinner).toBeTruthy();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    expect(btn.disabled).toBe(true);

    const genReq = httpTesting.expectOne('/api/v1/rota/generate');
    genReq.flush(mockAcRotaResponse);
    fixture.detectChanges();

    const overlayAfter = fixture.nativeElement.querySelector('.loading-overlay');
    expect(overlayAfter).toBeFalsy();
  });

  it('should show error notification when generation fails', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    const notificationService = TestBed.inject(NotificationService);

    const generateBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    generateBtn.click();
    fixture.detectChanges();

    const genReq = httpTesting.expectOne('/api/v1/rota/generate');
    genReq.flush(
      {
        statusCode: 400,
        message: 'Pool of 8 is too large for AC: target 12960h exceeds yearly coverage capacity 6627h.',
        error: 'Bad Request',
      },
      { status: 400, statusText: 'Bad Request' }
    );
    fixture.detectChanges();

    const notifications = notificationService.notifications();
    expect(notifications.length).toBeGreaterThan(0);
    const errorNotif = notifications.find((n) => n.type === 'error');
    expect(errorNotif).toBeTruthy();
    expect(errorNotif!.message).toContain('Failed to generate AC rota');
    expect(errorNotif!.message).toContain('too large');
    expect(errorNotif!.message).toContain('12960h');
  });

  it('should show success notification after generation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    const notificationService = TestBed.inject(NotificationService);

    const generateBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    generateBtn.click();
    fixture.detectChanges();

    const genReq = httpTesting.expectOne('/api/v1/rota/generate');
    genReq.flush(mockAcRotaResponse);
    fixture.detectChanges();

    const notifications = notificationService.notifications();
    expect(notifications.length).toBeGreaterThan(0);
    const successNotif = notifications.find((n) => n.type === 'success');
    expect(successNotif).toBeTruthy();
    expect(successNotif!.message).toContain('AC rota generated successfully');
  });

  it('should show empty state when no rota exists', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();

    const message = fixture.nativeElement.querySelector('.empty-state-message');
    expect(message.textContent).toContain('No rota generated');

    const hint = fixture.nativeElement.querySelector('.empty-state-hint');
    expect(hint.textContent).toContain('Add doctors to the pool and click Generate Rota');
  });

  it('should show pool tabs for AC and AP', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.tab-btn');
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent.trim()).toBe('AC');
    expect(tabs[1].textContent.trim()).toBe('AP');
  });

  it('should filter pool doctors by active tab', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    // AC tab active by default — should show 2 AC doctors
    const cards = fixture.nativeElement.querySelectorAll('app-doctor-card');
    expect(cards.length).toBe(2); // doc-001, doc-002 are AC
  });

  it('should offer a missing refuerzo assignment target for reduced-hours AC primaries', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({
      rotaStatus: 404,
      doctors: [
        { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General', rota_type: 'AC', hours_reduced_per_day: 2 },
        { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria', rota_type: 'AC' },
        { id: 'doc-003', name: 'Dr. Martinez', department: 'Cardiologia', rota_type: 'AC' },
      ],
    });
    fixture.detectChanges();

    const event: ReplacementEvent = {
      date: '2026-01-15',
      newDoctor: { id: 'doc-003', name: 'Dr. Martinez', department: 'Cardiologia', rota_type: 'AC' },
      acDoctors: [{ doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' }],
      acRefuerzos: [],
      apDoctors: [],
    };

    const options = fixture.componentInstance['getReplaceableDoctors']('AC', event);
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          doctor_id: 'doc-001',
          assignment_kind: 'refuerzo',
          linked_primary_doctor_id: 'doc-001',
        }),
      ])
    );
  });

  it('should block reduced-hours doctors from refuerzo targets in the picker', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({
      rotaStatus: 404,
      doctors: [
        { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General', rota_type: 'AC', hours_reduced_per_day: 2 },
        { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria', rota_type: 'AC', hours_reduced_per_day: 2 },
        { id: 'doc-003', name: 'Dr. Martinez', department: 'Cardiologia', rota_type: 'AC' },
      ],
    });
    fixture.detectChanges();

    const event: ReplacementEvent = {
      date: '2026-01-15',
      newDoctor: { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria', rota_type: 'AC', hours_reduced_per_day: 2 },
      acDoctors: [{ doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' }],
      acRefuerzos: [
        {
          doctor_id: 'doc-003',
          doctor_name: 'Dr. Martinez',
          linked_primary_doctor_id: 'doc-001',
          linked_primary_doctor_name: 'Dr. Garcia',
          shift_start: '15:00',
          shift_end: '22:00',
          duration_hours: 7,
        },
      ],
      apDoctors: [],
    };

    const options = fixture.componentInstance['getReplaceableDoctors']('AC', event);
    expect(options.every((option: { assignment_kind: string }) => option.assignment_kind === 'primary')).toBe(true);
  });
});
