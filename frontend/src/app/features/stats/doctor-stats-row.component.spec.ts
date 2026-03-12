import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorStatsRowComponent } from './doctor-stats-row.component';
import { DoctorStats } from '../../core/models/rota.model';

describe('DoctorStatsRowComponent', () => {
  let component: DoctorStatsRowComponent;
  let fixture: ComponentFixture<DoctorStatsRowComponent>;

  const mockStats: DoctorStats = {
    doctor_id: 'doc-001',
    doctor_name: 'Dr. Garcia',
    total_hours: 572,
    ac_hours: 140,
    ap_hours: 432,
    shifts_weekday: 20,
    shifts_saturday: 5,
    shifts_sunday_holiday: 4,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorStatsRowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorStatsRowComponent);
    component = fixture.componentInstance;
  });

  it('should display doctor name', () => {
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const nameEl = fixture.nativeElement.querySelector('.doctor-name');
    expect(nameEl).toBeTruthy();
    expect(nameEl.textContent).toContain('Dr. Garcia');
  });

  it('should display all stat values', () => {
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    // Total hours
    expect(text).toContain('572');

    // AC hours
    expect(text).toContain('140');

    // AP hours
    expect(text).toContain('432');

    // Shift counts by day type
    expect(text).toContain('20'); // weekday
    expect(text).toContain('5');  // saturday
    expect(text).toContain('4');  // sunday/holiday
  });

  it('should display total_hours, ac_hours, ap_hours in stats grid', () => {
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const statValues = fixture.nativeElement.querySelectorAll('.stat-value');
    const statTexts = Array.from(statValues).map((el: any) => el.textContent.trim());

    expect(statTexts).toContain('572h');
    expect(statTexts).toContain('140h');
    expect(statTexts).toContain('432h');
  });

  it('should display shifts_weekday, shifts_saturday, shifts_sunday_holiday as badges', () => {
    fixture.componentRef.setInput('stats', mockStats);
    fixture.detectChanges();

    const weekdayBadge = fixture.nativeElement.querySelector('.shift-badge.weekday');
    const saturdayBadge = fixture.nativeElement.querySelector('.shift-badge.saturday');
    const holidayBadge = fixture.nativeElement.querySelector('.shift-badge.holiday');

    expect(weekdayBadge).toBeTruthy();
    expect(weekdayBadge.textContent).toContain('20');

    expect(saturdayBadge).toBeTruthy();
    expect(saturdayBadge.textContent).toContain('5');

    expect(holidayBadge).toBeTruthy();
    expect(holidayBadge.textContent).toContain('4');
  });
});
