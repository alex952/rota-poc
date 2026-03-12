import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonthViewComponent } from './month-view.component';
import { DayAssignment } from '../../core/models/rota.model';

describe('MonthViewComponent', () => {
  let component: MonthViewComponent;
  let fixture: ComponentFixture<MonthViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MonthViewComponent);
    component = fixture.componentInstance;
  });

  it('should render correct number of days for January (31 days)', () => {
    fixture.componentRef.setInput('month', 1);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('assignments', []);
    fixture.detectChanges();

    const dayCells = fixture.nativeElement.querySelectorAll('app-day-cell');
    expect(dayCells.length).toBe(31);
  });

  it('should render correct number of days for February in non-leap year (28 days)', () => {
    fixture.componentRef.setInput('month', 2);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('assignments', []);
    fixture.detectChanges();

    const dayCells = fixture.nativeElement.querySelectorAll('app-day-cell');
    expect(dayCells.length).toBe(28);
  });

  it('should render correct number of days for February in leap year (29 days)', () => {
    fixture.componentRef.setInput('month', 2);
    fixture.componentRef.setInput('year', 2028);
    fixture.componentRef.setInput('assignments', []);
    fixture.detectChanges();

    const dayCells = fixture.nativeElement.querySelectorAll('app-day-cell');
    expect(dayCells.length).toBe(29);
  });

  it('should display month name and year as header', () => {
    fixture.componentRef.setInput('month', 3);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('assignments', []);
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('.month-header');
    expect(header.textContent).toContain('March');
    expect(header.textContent).toContain('2026');
  });

  it('should show day-of-week headers (Mon-Sun)', () => {
    fixture.componentRef.setInput('month', 1);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('assignments', []);
    fixture.detectChanges();

    const dayHeaders = fixture.nativeElement.querySelectorAll('.day-header');
    expect(dayHeaders.length).toBe(7);

    const headerTexts = Array.from(dayHeaders).map((el: any) => el.textContent.trim());
    expect(headerTexts).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('should pass assignments to day cells', () => {
    const assignments: DayAssignment[] = [
      {
        date: '2026-01-15',
        day_type: 'weekday',
        shift_start: '15:00',
        shift_end: '08:00+1',
        duration_hours: 17,
        atencion_continuada: { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' },
        atencion_primaria: { doctor_id: 'doc-002', doctor_name: 'Dr. Lopez' },
      },
    ];

    fixture.componentRef.setInput('month', 1);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('assignments', assignments);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Dr. Garcia');
    expect(text).toContain('Dr. Lopez');
  });
});
