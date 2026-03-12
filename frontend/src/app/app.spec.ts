import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { App } from './app';
import { RotaResponse } from './core/models/rota.model';
import { Doctor } from './core/models/doctor.model';
import { NotificationService } from './core/services/notification.service';

const mockDoctors: Doctor[] = [
  { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General' },
  { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria' },
];

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
      {
        doctor_id: 'doc-002',
        doctor_name: 'Dr. Lopez',
        total_hours: 568,
        ac_hours: 138,
        ap_hours: 430,
        shifts_weekday: 19,
        shifts_saturday: 5,
        shifts_sunday_holiday: 5,
      },
    ],
  },
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
    rota?: RotaResponse | null;
  }) {
    const city = options?.city ?? 'Madrid';
    const doctors = options?.doctors ?? mockDoctors;
    const rotaStatus = options?.rotaStatus ?? 200;
    const rota = options?.rota ?? mockRotaResponse;

    const configReq = httpTesting.expectOne('/api/v1/config');
    configReq.flush({ city });

    const doctorsReq = httpTesting.expectOne('assets/doctors.json');
    doctorsReq.flush(doctors);

    const currentYear = new Date().getFullYear();
    const rotaReq = httpTesting.expectOne(`/api/v1/rota/${currentYear}`);
    if (rotaStatus === 200 && rota) {
      rotaReq.flush(rota);
    } else {
      rotaReq.flush({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' });
    }
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

  it('should load rota on init and populate calendar', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 200, rota: mockRotaResponse });
    fixture.detectChanges();

    const app = fixture.componentInstance;
    expect(app['schedule']()).toEqual(mockRotaResponse.schedule);
    expect(app['stats']()).toEqual(mockRotaResponse.stats.doctors);
    expect(app['hasExistingRota']()).toBe(true);
  });

  it('should show Generate Rota when no rota exists', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    const generateBtn = fixture.nativeElement.querySelector('.btn-generate');
    expect(generateBtn.textContent).toContain('Generate Rota');
    expect(generateBtn.textContent).not.toContain('Re-generate');
  });

  it('should show Re-generate Rota when rota exists', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 200, rota: mockRotaResponse });
    fixture.detectChanges();

    const generateBtn = fixture.nativeElement.querySelector('.btn-generate');
    expect(generateBtn.textContent).toContain('Re-generate Rota');
  });

  it('should call generateRota when generate button clicked (no existing rota)', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    const generateBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    generateBtn.click();
    fixture.detectChanges();

    // Should directly call generate (no confirm dialog since no existing rota)
    const currentYear = new Date().getFullYear();
    const genReq = httpTesting.expectOne('/api/v1/rota/generate');
    expect(genReq.request.method).toBe('POST');
    expect(genReq.request.body.year).toBe(currentYear);
    expect(genReq.request.body.pool).toEqual(mockDoctors);
    genReq.flush(mockRotaResponse);
    fixture.detectChanges();

    expect(fixture.componentInstance['hasExistingRota']()).toBe(true);
  });

  it('should show confirm dialog when re-generating', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 200, rota: mockRotaResponse });
    fixture.detectChanges();

    // Click re-generate
    const generateBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    generateBtn.click();
    fixture.detectChanges();

    // Confirm dialog should appear
    const confirmDialog = fixture.nativeElement.querySelector('.confirm-dialog-backdrop');
    expect(confirmDialog).toBeTruthy();

    // Click confirm
    const confirmBtn = confirmDialog.querySelector('.btn-confirm');
    confirmBtn.click();
    fixture.detectChanges();

    // Now the generate request should fire
    const genReq = httpTesting.expectOne('/api/v1/rota/generate');
    expect(genReq.request.method).toBe('POST');
    genReq.flush(mockRotaResponse);
    fixture.detectChanges();

    // Dialog should be gone
    const dialogAfter = fixture.nativeElement.querySelector('.confirm-dialog-backdrop');
    expect(dialogAfter).toBeFalsy();
  });

  it('should reload rota when year changes', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 200, rota: mockRotaResponse });
    fixture.detectChanges();

    // Change the year via the year input
    const yearInput: HTMLInputElement = fixture.nativeElement.querySelector('.year-input');
    yearInput.value = '2025';
    yearInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    // Should make a new request for 2025
    const rotaReq = httpTesting.expectOne('/api/v1/rota/2025');
    expect(rotaReq.request.method).toBe('GET');
    rotaReq.flush({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(fixture.componentInstance['hasExistingRota']()).toBe(false);
    expect(fixture.componentInstance['schedule']()).toEqual([]);
  });

  // --- Phase 10: Loading states, error handling, empty state ---

  it('should show loading spinner during rota generation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    // Click generate
    const generateBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    generateBtn.click();
    fixture.detectChanges();

    // Loading overlay should be visible
    const overlay = fixture.nativeElement.querySelector('.loading-overlay');
    expect(overlay).toBeTruthy();

    const spinner = fixture.nativeElement.querySelector('.spinner');
    expect(spinner).toBeTruthy();

    // Generate button should be disabled
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    expect(btn.disabled).toBe(true);

    // Flush the generate request
    const genReq = httpTesting.expectOne('/api/v1/rota/generate');
    genReq.flush(mockRotaResponse);
    fixture.detectChanges();

    // Overlay should be gone
    const overlayAfter = fixture.nativeElement.querySelector('.loading-overlay');
    expect(overlayAfter).toBeFalsy();
  });

  it('should show error notification when generation fails', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    const notificationService = TestBed.inject(NotificationService);

    // Click generate
    const generateBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    generateBtn.click();
    fixture.detectChanges();

    // Fail the generate request
    const genReq = httpTesting.expectOne('/api/v1/rota/generate');
    genReq.flush(
      { detail: 'Pool has fewer than 2 doctors' },
      { status: 400, statusText: 'Bad Request' }
    );
    fixture.detectChanges();

    // Should have an error notification
    const notifications = notificationService.notifications();
    expect(notifications.length).toBeGreaterThan(0);
    const errorNotif = notifications.find((n) => n.type === 'error');
    expect(errorNotif).toBeTruthy();
    expect(errorNotif!.message).toContain('Failed to generate rota');
    expect(errorNotif!.message).toContain('Pool has fewer than 2 doctors');
  });

  it('should show success notification after generation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    const notificationService = TestBed.inject(NotificationService);

    // Click generate
    const generateBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-generate');
    generateBtn.click();
    fixture.detectChanges();

    // Flush the generate request
    const genReq = httpTesting.expectOne('/api/v1/rota/generate');
    genReq.flush(mockRotaResponse);
    fixture.detectChanges();

    // Should have a success notification
    const notifications = notificationService.notifications();
    expect(notifications.length).toBeGreaterThan(0);
    const successNotif = notifications.find((n) => n.type === 'success');
    expect(successNotif).toBeTruthy();
    expect(successNotif!.message).toContain('Rota generated successfully');
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
});
