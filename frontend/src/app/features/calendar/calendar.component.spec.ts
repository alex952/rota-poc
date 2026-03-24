import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarComponent } from './calendar.component';
import { MergedDayAssignment } from '../../core/models/rota.model';

describe('CalendarComponent', () => {
  let component: CalendarComponent;
  let fixture: ComponentFixture<CalendarComponent>;

  const mockSchedule: MergedDayAssignment[] = [
    {
      date: '2026-01-01',
      day_type: 'holiday',
      shift_start: '09:00',
      shift_end: '08:00+1',
      duration_hours: 23,
      acDoctors: [{ doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' }],
      apDoctors: [{ doctor_id: 'doc-011', doctor_name: 'Dr. Navarro' }],
    },
    {
      date: '2026-02-15',
      day_type: 'weekday',
      shift_start: '15:00',
      shift_end: '08:00+1',
      duration_hours: 17,
      acDoctors: [{ doctor_id: 'doc-002', doctor_name: 'Dr. Lopez' }],
      acRefuerzos: [
        {
          doctor_id: 'doc-003',
          doctor_name: 'Dr. Martinez',
          linked_primary_doctor_id: 'doc-002',
          linked_primary_doctor_name: 'Dr. Lopez',
          shift_start: '15:00',
          shift_end: '20:00',
          duration_hours: 5,
        },
      ],
      apDoctors: [{ doctor_id: 'doc-011', doctor_name: 'Dr. Navarro' }],
    },
    {
      date: '2026-06-20',
      day_type: 'saturday',
      shift_start: '15:00',
      shift_end: '09:00+1',
      duration_hours: 18,
      acDoctors: [{ doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' }],
      apDoctors: [{ doctor_id: 'doc-012', doctor_name: 'Dr. Torres' }],
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
    component.currentMonth.set(1);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Dr. Garcia');
    expect(text).toContain('Dr. Navarro');
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
    component.currentMonth.set(3);
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

    const yearDisplay = fixture.nativeElement.querySelector('.calendar-header');
    expect(yearDisplay).toBeTruthy();
  });

  it('should emit yearChange event when year changes', () => {
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('schedule', []);
    fixture.detectChanges();

    const spy = vi.fn();
    component.yearChange.subscribe(spy);

    const yearInput = fixture.nativeElement.querySelector('.year-input') as HTMLInputElement;
    if (yearInput) {
      yearInput.value = '2027';
      yearInput.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(spy).toHaveBeenCalledWith(2027);
    }
  });

  it('should switch to day view when a day is clicked and return to month view', () => {
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('schedule', mockSchedule);
    component.currentMonth.set(1);
    fixture.detectChanges();

    const dayCell = fixture.nativeElement.querySelector('.day-cell') as HTMLElement;
    dayCell.click();
    fixture.detectChanges();

    expect(component.viewMode()).toBe('day');
    expect(fixture.nativeElement.textContent).toContain('Detailed assignments for the selected day.');

    const backButton = fixture.nativeElement.querySelector('.back-btn') as HTMLButtonElement;
    backButton.click();
    fixture.detectChanges();

    expect(component.viewMode()).toBe('month');
    expect(fixture.nativeElement.querySelector('app-month-view')).toBeTruthy();
  });

  it('should keep days where the filtered doctor is assigned as refuerzo', () => {
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('schedule', mockSchedule);
    component.currentMonth.set(2);
    component.filteredDoctor.set({ doctor_id: 'doc-003', doctor_name: 'Dr. Martinez' });
    fixture.detectChanges();

    expect(component.currentAssignments()).toHaveLength(1);
    expect(component.currentAssignments()[0].date).toBe('2026-02-15');
  });
});
