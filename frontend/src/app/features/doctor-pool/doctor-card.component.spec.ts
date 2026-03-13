import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorCardComponent } from './doctor-card.component';
import { Doctor } from '../../core/models/doctor.model';

describe('DoctorCardComponent', () => {
  let component: DoctorCardComponent;
  let fixture: ComponentFixture<DoctorCardComponent>;

  const mockDoctor: Doctor = {
    id: 'doc-001',
    name: 'Dr. Garcia',
    department: 'Medicina General',
    rota_type: 'AC',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorCardComponent);
    component = fixture.componentInstance;
  });

  it('should display doctor name and department', () => {
    fixture.componentRef.setInput('doctor', mockDoctor);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Dr. Garcia');
    expect(text).toContain('Medicina General');
  });

  it('should be draggable', () => {
    fixture.componentRef.setInput('doctor', mockDoctor);
    fixture.detectChanges();

    // CdkDrag adds the 'cdk-drag' CSS class to the host element
    const draggable = fixture.nativeElement.querySelector('.cdk-drag');
    expect(draggable).toBeTruthy();
  });
});
