import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorPoolComponent } from './doctor-pool.component';
import { Doctor } from '../../core/models/doctor.model';

describe('DoctorPoolComponent', () => {
  let component: DoctorPoolComponent;
  let fixture: ComponentFixture<DoctorPoolComponent>;

  const mockDoctors: Doctor[] = [
    { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General' },
    { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria' },
    { id: 'doc-003', name: 'Dr. Martinez', department: 'Cardiologia' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorPoolComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorPoolComponent);
    component = fixture.componentInstance;
  });

  it('should display doctor cards from static config', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-doctor-card');
    expect(cards.length).toBe(3);
  });

  it('should show Add Doctor button', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.btn-add-doctor');
    expect(addButton).toBeTruthy();
    expect(addButton.textContent.trim()).toContain('Add Doctor');
  });

  it('should show Generate Rota button when no rota exists', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const generateButton = fixture.nativeElement.querySelector('.btn-generate');
    expect(generateButton).toBeTruthy();
    expect(generateButton.textContent.trim()).toBe('Generate Rota');
  });

  it('should show Re-generate Rota button when rota exists', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('hasExistingRota', true);
    fixture.detectChanges();

    const generateButton = fixture.nativeElement.querySelector('.btn-generate');
    expect(generateButton).toBeTruthy();
    expect(generateButton.textContent.trim()).toBe('Re-generate Rota');
  });

  it('should emit generateRota event when button clicked', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const spy = vi.fn();
    component.generateRota.subscribe(spy);

    const generateButton = fixture.nativeElement.querySelector('.btn-generate');
    generateButton.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit addDoctor event when Add Doctor clicked', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const spy = vi.fn();
    component.addDoctorClick.subscribe(spy);

    const addButton = fixture.nativeElement.querySelector('.btn-add-doctor');
    addButton.click();
    expect(spy).toHaveBeenCalled();
  });
});
