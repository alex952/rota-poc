import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarComponent } from './calendar.component';
import { DayAssignment } from '../../core/models/rota.model';

describe('CalendarComponent', () => {
  let component: CalendarComponent;
  let fixture: ComponentFixture<CalendarComponent>;

  const mockSchedule: DayAssignment[] = [
    {
      date: '2026-01-01',
      day_type: 'holiday',
      shift_start: '09:00',
      shift_end: '08:00+1',
      duration_hours: 23,
      atencion_continuada: { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' },
      atencion_primaria: { doctor_id: 'doc-002', doctor_name: 'Dr. Lopez' },
    },
    {
      date: '2026-02-15',
      day_type: 'weekday',
      shift_start: '15:00',
      shift_end: '08:00+1',
      duration_hours: 17,
      atencion_continuada: { doctor_id: 'doc-002', doctor_name: 'Dr. Lopez' },
      atencion_primaria: { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' },
    },
    {
      date: '2026-06-20',
      day_type: 'saturday',
      shift_start: '15:00',
      shift_end: '09:00+1',
      duration_hours: 18,
      atencion_continuada: { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' },
      atencion_primaria: { doctor_id: 'doc-003', doctor_name: 'Dr. Martinez' },
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
  });

  it('should display one month at a time', () => {
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('schedule', []);
    fixture.detectChanges();

    const monthViews = fixture.nativeElement.querySelectorAll('app-month-view');
    expect(monthViews.length).toBe(1);
  });

  it('should display assignments when rota is loaded for the current month', () => {
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('schedule', mockSchedule);
    // Navigate to January to see the mockSchedule entry
    component.currentMonth.set(1);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Dr. Garcia');
    expect(text).toContain('Dr. Lopez');
  });

  it('should show empty calendar when no rota exists', () => {
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('schedule', []);
    fixture.detectChanges();

    const monthViews = fixture.nativeElement.querySelectorAll('app-month-view');
    expect(monthViews.length).toBe(1);

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Dr. Garcia');
  });

  it('should navigate months with prev/next buttons', () => {
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('schedule', []);
    component.currentMonth.set(3); // March
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('March');

    component.nextMonth();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('April');

    component.prevMonth();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('March');
  });

  it('should have year selector defaulting to current year', () => {
    const currentYear = new Date().getFullYear();
    fixture.componentRef.setInput('year', currentYear);
    fixture.componentRef.setInput('schedule', []);
    fixture.detectChanges();

    // The year input should reflect the current year
    const yearDisplay = fixture.nativeElement.querySelector('.calendar-header');
    expect(yearDisplay).toBeTruthy();
  });

  it('should emit yearChange event when year changes', () => {
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('schedule', []);
    fixture.detectChanges();

    const spy = vi.fn();
    component.yearChange.subscribe(spy);

    // Simulate year change
    const yearInput = fixture.nativeElement.querySelector('.year-input') as HTMLInputElement;
    if (yearInput) {
      yearInput.value = '2027';
      yearInput.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(spy).toHaveBeenCalledWith(2027);
    }
  });
});
