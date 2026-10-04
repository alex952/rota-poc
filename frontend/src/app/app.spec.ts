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

  describe('exportar a Excel', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    let createObjectURL: ReturnType<typeof vi.fn>;
    let revokeObjectURL: ReturnType<typeof vi.fn>;
    let anchorClick: ReturnType<typeof vi.spyOn>;
    let anchorDownloads: string[];

    beforeEach(() => {
      createObjectURL = vi.fn(() => 'blob:cuadrante');
      revokeObjectURL = vi.fn();
      URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
      URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
      anchorDownloads = [];
      anchorClick = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          anchorDownloads.push(this.download);
        });
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      anchorClick.mockRestore();
    });

    function exportButton(fixture: { nativeElement: HTMLElement }): HTMLButtonElement {
      const button = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.app-header button'),
      ).find((candidate) => candidate.textContent?.trim() === 'Exportar a Excel');
      if (!button) {
        throw new Error('No se ha encontrado el botón «Exportar a Excel»');
      }
      return button;
    }

    it('should disable the export button when there is no rota', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      flushInitRequests({ rotaStatus: 404 });
      fixture.detectChanges();

      expect(exportButton(fixture).disabled).toBe(true);
    });

    it('should place the export button before the stats button', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      flushInitRequests();
      fixture.detectChanges();

      const buttons = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.app-header button'),
      );
      expect(buttons.indexOf(exportButton(fixture))).toBeLessThan(
        buttons.indexOf(fixture.nativeElement.querySelector('.btn-stats')),
      );
    });

    it('should enable the export button when a rota exists', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      flushInitRequests();
      fixture.detectChanges();

      expect(exportButton(fixture).disabled).toBe(false);
    });

    it('should request the file and trigger the download on click', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      flushInitRequests();
      fixture.detectChanges();

      exportButton(fixture).click();
      fixture.detectChanges();
      expect(exportButton(fixture).disabled).toBe(true);

      const year = new Date().getFullYear();
      const req = httpTesting.expectOne(`/api/v1/rota/${year}/export`);
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['xlsx']));
      fixture.detectChanges();

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(anchorDownloads).toEqual([`cuadrante-guardias-${year}.xlsx`]);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:cuadrante');
      expect(exportButton(fixture).disabled).toBe(false);
    });

    it('should show the backend message in Spanish when the export fails', async () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      flushInitRequests();
      fixture.detectChanges();
      const notificationService = TestBed.inject(NotificationService);

      exportButton(fixture).click();
      const year = new Date().getFullYear();
      const body = JSON.stringify({
        message: `No se ha encontrado ningún cuadrante para el año ${year}`,
      });
      httpTesting
        .expectOne(`/api/v1/rota/${year}/export`)
        .flush(new Blob([body], { type: 'application/json' }), {
          status: 404,
          statusText: 'Not Found',
        });
      await fixture.whenStable();
      fixture.detectChanges();

      const [notification] = notificationService.notifications();
      expect(notification.type).toBe('error');
      expect(notification.message).toBe(
        `No se ha podido exportar el cuadrante: No se ha encontrado ningún cuadrante para el año ${year}`,
      );
      expect(notification.message).not.toContain('Http failure');
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(exportButton(fixture).disabled).toBe(false);
    });

    it('should fall back to the Spanish generic message when the error body is not JSON', async () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      flushInitRequests();
      fixture.detectChanges();
      const notificationService = TestBed.inject(NotificationService);

      exportButton(fixture).click();
      const year = new Date().getFullYear();
      httpTesting
        .expectOne(`/api/v1/rota/${year}/export`)
        .flush(new Blob(['<html>Bad Gateway</html>']), {
          status: 502,
          statusText: 'Bad Gateway',
        });
      await fixture.whenStable();

      const [notification] = notificationService.notifications();
      expect(notification.message).toMatch(/^No se ha podido exportar el cuadrante/);
      expect(notification.message).not.toContain('Http failure');
    });
  });
});
