import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatsPanelComponent } from './stats-panel.component';
import { DoctorStats } from '../../core/models/rota.model';

describe('StatsPanelComponent', () => {
  let component: StatsPanelComponent;
  let fixture: ComponentFixture<StatsPanelComponent>;

  const mockStats: DoctorStats[] = [
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
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsPanelComponent);
    component = fixture.componentInstance;
  });

  it('should display per-doctor hour breakdowns when rota stats provided', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Dr. Garcia');
    expect(text).toContain('Dr. Lopez');
    expect(text).toContain('572');
    expect(text).toContain('568');
  });

  it('should show total hours, AC hours, AP hours for each doctor', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    // Dr. Garcia stats
    expect(text).toContain('572');
    expect(text).toContain('140');
    expect(text).toContain('432');

    // Dr. Lopez stats
    expect(text).toContain('568');
    expect(text).toContain('138');
    expect(text).toContain('430');
  });

  it('should show shift counts by day type', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    // Weekday, Saturday, Sunday/holiday counts should be present
    expect(text).toContain('20'); // Garcia weekday
    expect(text).toContain('19'); // Lopez weekday
    expect(text).toContain('5');  // saturday
    expect(text).toContain('4');  // Garcia holiday
  });

  it('should be hidden by default', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.stats-panel');
    // When not visible, the panel should be off-screen via transform
    expect(panel).toBeTruthy();
    const styles = getComputedStyle(panel);
    // The panel exists in DOM but is translated off-screen
    expect(panel.classList.contains('open')).toBe(false);
  });

  it('should toggle open/closed when visible changes', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    let panel = fixture.nativeElement.querySelector('.stats-panel');
    expect(panel.classList.contains('open')).toBe(false);

    // Toggle to open
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    panel = fixture.nativeElement.querySelector('.stats-panel');
    expect(panel.classList.contains('open')).toBe(true);
  });

  it('should show equity indicator when there is a significant imbalance', () => {
    const imbalancedStats: DoctorStats[] = [
      {
        doctor_id: 'doc-001',
        doctor_name: 'Dr. Garcia',
        total_hours: 600,
        ac_hours: 160,
        ap_hours: 440,
        shifts_weekday: 22,
        shifts_saturday: 6,
        shifts_sunday_holiday: 5,
      },
      {
        doctor_id: 'doc-002',
        doctor_name: 'Dr. Lopez',
        total_hours: 500,
        ac_hours: 135,
        ap_hours: 365,
        shifts_weekday: 16,
        shifts_saturday: 4,
        shifts_sunday_holiday: 3,
      },
    ];

    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('stats', imbalancedStats);
    fixture.detectChanges();

    // Should show a warning indicator when max-min difference > 10% of max
    const warningEl = fixture.nativeElement.querySelector('.equity-warning');
    expect(warningEl).toBeTruthy();
    expect(warningEl.textContent.toLowerCase()).toContain('imbalance');
  });

  it('should not show equity warning when distribution is balanced', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    // The difference between 572 and 568 is well within 10%
    const warningEl = fixture.nativeElement.querySelector('.equity-warning');
    expect(warningEl).toBeFalsy();
  });

  it('should show summary section with total and average hours', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const summaryEl = fixture.nativeElement.querySelector('.stats-summary');
    expect(summaryEl).toBeTruthy();

    const summaryText = summaryEl.textContent;
    // Total hours: 572 + 568 = 1140
    expect(summaryText).toContain('1140');
    // Average hours: 1140 / 2 = 570
    expect(summaryText).toContain('570');
  });

  it('should show header with title and close button', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('.stats-title');
    expect(title).toBeTruthy();
    expect(title.textContent).toContain('Rota Statistics');

    const closeBtn = fixture.nativeElement.querySelector('.btn-close-stats');
    expect(closeBtn).toBeTruthy();
  });

  it('should emit close event when close button is clicked', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const spy = vi.fn();
    component.closed.subscribe(spy);

    const closeBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-close-stats');
    closeBtn.click();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalled();
  });

  it('should show no-stats message when stats array is empty and panel is open', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('stats', []);
    fixture.detectChanges();

    const noStatsEl = fixture.nativeElement.querySelector('.no-stats');
    expect(noStatsEl).toBeTruthy();
    expect(noStatsEl.textContent.toLowerCase()).toContain('no statistics');
  });

  it('should render doctor-stats-row components for each doctor', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('app-doctor-stats-row');
    expect(rows.length).toBe(2);
  });
});
