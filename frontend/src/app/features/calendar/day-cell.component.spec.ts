import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DayCellComponent } from './day-cell.component';
import { DayAssignment } from '../../core/models/rota.model';

describe('DayCellComponent', () => {
  let component: DayCellComponent;
  let fixture: ComponentFixture<DayCellComponent>;

  const mockAssignment: DayAssignment = {
    date: '2026-01-15',
    day_type: 'weekday',
    shift_start: '15:00',
    shift_end: '08:00+1',
    duration_hours: 17,
    atencion_continuada: { doctor_id: 'doc-001', doctor_name: 'Dr. Garcia' },
    atencion_primaria: { doctor_id: 'doc-002', doctor_name: 'Dr. Lopez' },
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

    // Verify AC and AP labels are shown
    const acLabel = fixture.nativeElement.querySelector('.ac-assignment');
    const apLabel = fixture.nativeElement.querySelector('.ap-assignment');
    expect(acLabel).toBeTruthy();
    expect(apLabel).toBeTruthy();
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
    fixture.detectChanges();

    // CdkDropList adds the 'cdk-drop-list' CSS class to the host element
    const dropList = fixture.nativeElement.querySelector('.cdk-drop-list');
    expect(dropList).toBeTruthy();
  });
});
