import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DayCellComponent } from './day-cell.component';
import { MergedDayAssignment } from '../../core/models/rota.model';

describe('DayCellComponent', () => {
  let component: DayCellComponent;
  let fixture: ComponentFixture<DayCellComponent>;

  const mockAssignment: MergedDayAssignment = {
    date: '2026-01-15',
    day_type: 'weekday',
    shift_start: '15:00',
    shift_end: '08:00+1',
    duration_hours: 17,
    acDoctors: [{ doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' }],
    apDoctors: [{ doctor_id: 'doc-002', doctor_name: 'Dr. Lopez' }],
  };

  const mockMultiDoctorAssignment: MergedDayAssignment = {
    date: '2026-01-15',
    day_type: 'weekday',
    shift_start: '15:00',
    shift_end: '08:00+1',
    duration_hours: 17,
    acDoctors: [
      { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' },
      { doctor_id: 'doc-002', doctor_name: 'Dr. Lopez' },
      { doctor_id: 'doc-003', doctor_name: 'Dr. Martinez' },
    ],
    apDoctors: [{ doctor_id: 'doc-011', doctor_name: 'Dr. Navarro' }],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DayCellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DayCellComponent);
    component = fixture.componentInstance;
  });

  it('should display day number', () => {
    fixture.componentRef.setInput('day', 15);
    fixture.componentRef.setInput('assignment', null);
    fixture.componentRef.setInput('dayType', 'weekday');
    fixture.detectChanges();

    const dayNumber = fixture.nativeElement.querySelector('.day-number');
    expect(dayNumber.textContent.trim()).toBe('15');
  });

  it('should display AC and AP doctor names when assignment exists', () => {
    fixture.componentRef.setInput('day', 15);
    fixture.componentRef.setInput('assignment', mockAssignment);
    fixture.componentRef.setInput('dayType', 'weekday');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Dr. Garcia');
    expect(text).toContain('Dr. Lopez');

    const acSection = fixture.nativeElement.querySelector('.ac-section');
    const apSection = fixture.nativeElement.querySelector('.ap-section');
    expect(acSection).toBeTruthy();
    expect(apSection).toBeTruthy();
  });

  it('should show all doctors as pills when more than 2 per type', () => {
    fixture.componentRef.setInput('day', 15);
    fixture.componentRef.setInput('assignment', mockMultiDoctorAssignment);
    fixture.componentRef.setInput('dayType', 'weekday');
    fixture.detectChanges();

    const pills = fixture.nativeElement.querySelectorAll('.ac-section .doctor-pill');
    expect(pills.length).toBe(3);
    expect(pills[0].textContent).toContain('Dr. Garcia');
    expect(pills[1].textContent).toContain('Dr. Lopez');
    expect(pills[2].textContent).toContain('Dr. Martinez');
  });

  it('should visually distinguish weekday day type', () => {
    fixture.componentRef.setInput('day', 15);
    fixture.componentRef.setInput('assignment', null);
    fixture.componentRef.setInput('dayType', 'weekday');
    fixture.detectChanges();

    const cell = fixture.nativeElement.querySelector('.day-cell');
    expect(cell.classList.contains('day-weekday')).toBe(true);
  });

  it('should visually distinguish saturday day type', () => {
    fixture.componentRef.setInput('day', 17);
    fixture.componentRef.setInput('assignment', null);
    fixture.componentRef.setInput('dayType', 'saturday');
    fixture.detectChanges();

    const cell = fixture.nativeElement.querySelector('.day-cell');
    expect(cell.classList.contains('day-saturday')).toBe(true);
  });

  it('should visually distinguish holiday day type', () => {
    fixture.componentRef.setInput('day', 1);
    fixture.componentRef.setInput('assignment', null);
    fixture.componentRef.setInput('dayType', 'holiday');
    fixture.detectChanges();

    const cell = fixture.nativeElement.querySelector('.day-cell');
    expect(cell.classList.contains('day-holiday')).toBe(true);
  });

  it('should be a drop target for drag-and-drop', () => {
    fixture.componentRef.setInput('day', 15);
    fixture.componentRef.setInput('assignment', mockAssignment);
    fixture.componentRef.setInput('dayType', 'weekday');
    fixture.componentRef.setInput('date', '2026-01-15');
    fixture.detectChanges();

    const dropList = fixture.nativeElement.querySelector('.cdk-drop-list');
    expect(dropList).toBeTruthy();
  });

  it('should emit daySelected when clicking the cell', () => {
    fixture.componentRef.setInput('day', 15);
    fixture.componentRef.setInput('assignment', mockAssignment);
    fixture.componentRef.setInput('dayType', 'weekday');
    fixture.componentRef.setInput('date', '2026-01-15');
    fixture.detectChanges();

    const spy = vi.fn();
    component.daySelected.subscribe(spy);

    fixture.nativeElement.querySelector('.day-cell').click();

    expect(spy).toHaveBeenCalledWith('2026-01-15');
  });

  it('should expose a scrollable assignments container', () => {
    fixture.componentRef.setInput('day', 15);
    fixture.componentRef.setInput('assignment', mockMultiDoctorAssignment);
    fixture.componentRef.setInput('dayType', 'weekday');
    fixture.detectChanges();

    const assignments = fixture.nativeElement.querySelector('[data-testid="day-assignments"]');
    expect(assignments).toBeTruthy();
  });

  const fullDay: MergedDayAssignment = {
    date: '2026-12-24',
    day_type: 'holiday',
    shift_start: '09:00',
    shift_end: '08:00+1',
    duration_hours: 23,
    acDoctors: [
      { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia', role: 'guardia' },
      { doctor_id: 'doc-002', doctor_name: 'Dr. Lopez', role: 'refuerzo' },
    ],
    apDoctors: [
      { doctor_id: 'doc-011', doctor_name: 'Dr. Navarro', role: 'guardia' },
      { doctor_id: 'doc-012', doctor_name: 'Dr. Torres', role: 'refuerzo' },
    ],
  };

  function render(assignment: MergedDayAssignment, inputs: Record<string, unknown> = {}) {
    fixture.componentRef.setInput('day', 24);
    fixture.componentRef.setInput('assignment', assignment);
    fixture.componentRef.setInput('dayType', assignment.day_type);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  it('separa guardia AC, guardia AP y refuerzos del día', () => {
    render(fullDay);

    const ac = fixture.nativeElement.querySelectorAll('.ac-section .doctor-pill');
    const ap = fixture.nativeElement.querySelectorAll('.ap-section .doctor-pill');
    const refuerzos = fixture.nativeElement.querySelectorAll('.refuerzo-section .doctor-pill');

    expect([...ac].map((pill: Element) => pill.textContent!.trim())).toEqual(['Dr. Garcia']);
    expect([...ap].map((pill: Element) => pill.textContent!.trim())).toEqual(['Dr. Navarro']);
    expect([...refuerzos].map((pill: Element) => pill.textContent!.trim())).toEqual([
      'Dr. Torres',
      'Dr. Lopez (AC)',
    ]);
    expect(fixture.nativeElement.querySelector('.refuerzo-section .section-header').textContent.trim()).toBe(
      'REFUERZO',
    );
  });

  it('prefija los refuerzos con "R: " y distingue el refuerzo de un AC', () => {
    render(fullDay);

    const refuerzos: Element[] = [...fixture.nativeElement.querySelectorAll('.refuerzo-section .doctor-pill')];
    for (const pill of refuerzos) {
      expect(pill.classList.contains('refuerzo')).toBe(true);
    }
    expect(refuerzos[0].classList.contains('refuerzo-ac')).toBe(false);
    expect(refuerzos[1].classList.contains('refuerzo-ac')).toBe(true);
    expect(refuerzos[1].getAttribute('title')).toBe(
      'Refuerzo de un médico AC para completar sus horas del mes',
    );
    // La guardia AP ya no lleva el prefijo de refuerzo.
    expect(fixture.nativeElement.querySelector('.ap-section .doctor-pill').classList.contains('refuerzo')).toBe(false);
  });

  it('sin papel explícito trata a todos como guardia', () => {
    render(mockAssignment);
    expect(fixture.nativeElement.querySelector('.refuerzo-section')).toBeNull();
    expect(fixture.nativeElement.querySelector('.ap-section').textContent).toContain('Dr. Lopez');
  });

  it('marca los festivos especiales de sanidad por encima de los manuales', () => {
    render(fullDay, { isSpecialHoliday: true, isManualHoliday: true });

    const cell = fixture.nativeElement.querySelector('.day-cell');
    expect(cell.classList.contains('day-holiday-special')).toBe(true);
    expect(cell.classList.contains('day-holiday-manual')).toBe(false);
    expect(cell.getAttribute('title')).toBe('Festivo especial de sanidad');
    expect(component.effectiveDayType()).toBe('holiday-special');
  });
});
