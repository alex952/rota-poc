import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { App } from './app';
import { RotaResponse } from './core/models/rota.model';
import { Doctor } from './core/models/doctor.model';
import { NotificationService } from './core/services/notification.service';

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
    expect(generateBtn.textContent).toContain('Generar cuadrante AC');
  });

  it('should show Re-generate AC Rota when AC rota exists', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 200, rotas: [mockAcRotaResponse] });
    fixture.detectChanges();

    const generateBtn = fixture.nativeElement.querySelector('.btn-generate');
    expect(generateBtn.textContent).toContain('Regenerar cuadrante AC');
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
        message:
          'El grupo de 8 médicos es demasiado grande para AC: el objetivo de 12960h supera la capacidad anual de cobertura de 6627h.',
        error: 'Bad Request',
      },
      { status: 400, statusText: 'Bad Request' }
    );
    fixture.detectChanges();

    const notifications = notificationService.notifications();
    expect(notifications.length).toBeGreaterThan(0);
    const errorNotif = notifications.find((n) => n.type === 'error');
    expect(errorNotif).toBeTruthy();
    expect(errorNotif!.message).toContain('No se ha podido generar el cuadrante AC');
    expect(errorNotif!.message).toContain('demasiado grande');
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
    expect(successNotif!.message).toContain('Cuadrante AC generado correctamente');
  });

  it('should show empty calendar with warning when no rota exists', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushInitRequests({ rotaStatus: 404 });
    fixture.detectChanges();

    // El calendario debería mostrarse incluso sin rota
    const monthView = fixture.nativeElement.querySelector('app-month-view');
    expect(monthView).toBeTruthy();

    // Debería haber un warning visible
    const warning = fixture.nativeElement.querySelector('.no-rota-warning');
    expect(warning).toBeTruthy();
    expect(warning.textContent).toContain('No hay ningún cuadrante generado');
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

  describe('soltar un médico sobre un día', () => {
    const drop = (assigned: { doctor_id: string; doctor_name: string }[], newDoctor = mockDoctors[1]) => ({
      date: '2026-01-01',
      newDoctor,
      acDoctors: assigned,
      apDoctors: [],
    });
    const garcia = { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' };

    function setup() {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      flushInitRequests();
      fixture.detectChanges();
      return { fixture, app: fixture.componentInstance, notifications: TestBed.inject(NotificationService) };
    }

    it('con un solo médico asignado abre el diálogo y no lanza ninguna sustitución', () => {
      const { fixture, app } = setup();

      app.onDoctorDropped(drop([garcia]));
      fixture.detectChanges();

      expect(app['pendingReplacement']()).not.toBeNull();
      expect(fixture.nativeElement.querySelector('app-replace-doctor-dialog')).not.toBeNull();
      httpTesting.expectNone('/api/v1/rota/2026/AC/replace');
    });

    it('onAddDoctorToDay lanza el POST y aplica la rota devuelta', () => {
      const { fixture, app } = setup();
      app.onDoctorDropped(drop([garcia]));

      app.onAddDoctorToDay();

      expect(app['pendingReplacement']()).toBeNull();
      const req = httpTesting.expectOne((r) => r.url.endsWith('/AC/add'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ date: '2026-01-01', doctor_id: 'doc-002' });

      const updated: RotaResponse = {
        ...mockAcRotaResponse,
        schedule: [
          {
            ...mockAcRotaResponse.schedule[0],
            doctors: [garcia, { doctor_id: 'doc-002', doctor_name: 'Dr. Lopez' }],
          },
        ],
      };
      req.flush(updated);
      fixture.detectChanges();

      expect(app['acSchedule']()[0].doctors.length).toBe(2);
    });

    it('si el médico ya está asignado ese día avisa y no abre el diálogo', () => {
      const { app, notifications } = setup();

      app.onDoctorDropped(drop([garcia], mockDoctors[0]));

      expect(app['pendingReplacement']()).toBeNull();
      const last = notifications.notifications().at(-1);
      expect(last?.type).toBe('warning');
      expect(last?.message).toBe('Ese médico ya está asignado a la guardia de este día.');
    });

    it('sin médicos asignados mantiene el aviso actual', () => {
      const { app, notifications } = setup();

      app.onDoctorDropped(drop([]));

      expect(app['pendingReplacement']()).toBeNull();
      expect(notifications.notifications().at(-1)?.message).toBe(
        'No hay ninguna sustitución disponible para ese médico en este día.',
      );
    });
  });

});
