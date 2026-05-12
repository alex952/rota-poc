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

  it('muestra el AC con horario reducido en cursiva y su refuerzo dentro de la misma sección AC', () => {
    const reducedWithRefuerzo: MergedDayAssignment = {
      date: '2026-01-15',
      day_type: 'weekday',
      shift_start: '15:00',
      shift_end: '08:00+1',
      duration_hours: 17,
      acDoctors: [{ doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' }],
      acRefuerzos: [
        {
          doctor_id: 'doc-002',
          doctor_name: 'Dr. Lopez',
          linked_primary_doctor_id: 'doc-001',
          linked_primary_doctor_name: 'Dr. Garcia',
          shift_start: '15:00',
          shift_end: '22:00',
          duration_hours: 7,
        },
      ],
      apDoctors: [{ doctor_id: 'doc-011', doctor_name: 'Dr. Navarro' }],
    };

    fixture.componentRef.setInput('day', 15);
    fixture.componentRef.setInput('assignment', reducedWithRefuerzo);
    fixture.componentRef.setInput('dayType', 'weekday');
    fixture.detectChanges();

    const refuerzoHeader = fixture.nativeElement.querySelector('.refuerzo-section');
    expect(refuerzoHeader).toBeFalsy();

    const acPills = fixture.nativeElement.querySelectorAll('.ac-section .doctor-pill');
    expect(acPills.length).toBe(2);
    expect(acPills[0].textContent).toContain('Dr. Garcia');
    expect(acPills[0].classList.contains('reduced-hours')).toBe(true);
    expect(acPills[1].textContent).toContain('Dr. Lopez');
    expect(acPills[1].classList.contains('reduced-hours')).toBe(false);
  });

  it('renderiza los AP como refuerzos del día con prefijo "R: "', () => {
    const holidayAssignment: MergedDayAssignment = {
      date: '2026-01-01',
      day_type: 'holiday',
      shift_start: '10:00',
      shift_end: '22:00',
      duration_hours: 12,
      acDoctors: [{ doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' }],
      apDoctors: [
        { doctor_id: 'doc-011', doctor_name: 'Dr. Navarro' },
        { doctor_id: 'doc-012', doctor_name: 'Dr. Torres' },
      ],
    };

    fixture.componentRef.setInput('day', 1);
    fixture.componentRef.setInput('assignment', holidayAssignment);
    fixture.componentRef.setInput('dayType', 'holiday');
    fixture.detectChanges();

    const apPills = fixture.nativeElement.querySelectorAll('.ap-section .doctor-pill');
    expect(apPills.length).toBe(2);
    for (const pill of apPills) {
      expect(pill.classList.contains('ap-refuerzo')).toBe(true);
    }
    expect(apPills[0].textContent).toContain('Dr. Navarro');
    expect(apPills[1].textContent).toContain('Dr. Torres');
  });

  it('mantiene la cursiva del primary reducido aunque no exista refuerzo (caso degradado)', () => {
    const reducedWithoutRefuerzo: MergedDayAssignment = {
      date: '2026-02-10',
      day_type: 'weekday',
      shift_start: '15:00',
      shift_end: '08:00+1',
      duration_hours: 17,
      acDoctors: [{ doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' }],
      acRefuerzos: [],
      apDoctors: [{ doctor_id: 'doc-011', doctor_name: 'Dr. Navarro' }],
    };

    fixture.componentRef.setInput('day', 10);
    fixture.componentRef.setInput('assignment', reducedWithoutRefuerzo);
    fixture.componentRef.setInput('dayType', 'weekday');
    fixture.componentRef.setInput('reducedDoctorIds', new Set(['doc-001']));
    fixture.detectChanges();

    const acPills = fixture.nativeElement.querySelectorAll('.ac-section .doctor-pill');
    expect(acPills.length).toBe(1);
    expect(acPills[0].classList.contains('reduced-hours')).toBe(true);
  });
});
