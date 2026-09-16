import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoctorPoolComponent } from './doctor-pool.component';
import { Doctor } from '../../core/models/doctor.model';

describe('DoctorPoolComponent', () => {
  let component: DoctorPoolComponent;
  let fixture: ComponentFixture<DoctorPoolComponent>;

  const mockDoctors: Doctor[] = [
    { id: 'doc-001', name: 'Dr. Garcia', department: 'Medicina General', rota_type: 'AC' },
    { id: 'doc-002', name: 'Dr. Lopez', department: 'Pediatria', rota_type: 'AC' },
    { id: 'doc-003', name: 'Dr. Martinez', department: 'Cardiologia', rota_type: 'AC' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorPoolComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorPoolComponent);
    component = fixture.componentInstance;
  });

  it('should display doctor cards from pool', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('activeTab', 'AC');
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-doctor-card');
    expect(cards.length).toBe(3);
  });

  it('should show AC and AP tabs', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('activeTab', 'AC');
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.tab-btn');
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent.trim()).toBe('AC');
    expect(tabs[1].textContent.trim()).toBe('AP');
  });

  it('should highlight active AC tab', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('activeTab', 'AC');
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.tab-btn');
    expect(tabs[0].classList.contains('tab-active')).toBe(true);
    expect(tabs[1].classList.contains('tab-active')).toBe(false);
  });

  it('should show Add Doctor button', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('activeTab', 'AC');
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.btn-add-doctor');
    expect(addButton).toBeTruthy();
    expect(addButton.textContent.trim()).toContain('Añadir médico');
  });

  it('should show Generate AC Rota button when no rota exists', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('activeTab', 'AC');
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const generateButton = fixture.nativeElement.querySelector('.btn-generate');
    expect(generateButton).toBeTruthy();
    expect(generateButton.textContent.trim()).toBe('Generar cuadrante AC');
  });

  it('should show Re-generate AC Rota button when rota exists', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('activeTab', 'AC');
    fixture.componentRef.setInput('hasExistingRota', true);
    fixture.detectChanges();

    const generateButton = fixture.nativeElement.querySelector('.btn-generate');
    expect(generateButton).toBeTruthy();
    expect(generateButton.textContent.trim()).toBe('Regenerar cuadrante AC');
  });

  it('should emit generateRota event when button clicked', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('activeTab', 'AC');
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const spy = vi.fn();
    component.generateRota.subscribe(spy);

    const generateButton = fixture.nativeElement.querySelector('.btn-generate');
    generateButton.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit poolTabChange when tab is clicked', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('activeTab', 'AC');
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const spy = vi.fn();
    component.poolTabChange.subscribe(spy);

    const tabs = fixture.nativeElement.querySelectorAll('.tab-btn');
    tabs[1].click(); // Click AP tab
    expect(spy).toHaveBeenCalledWith('AP');
  });

  it('should emit addDoctor event when Add Doctor clicked', () => {
    fixture.componentRef.setInput('doctors', mockDoctors);
    fixture.componentRef.setInput('activeTab', 'AC');
    fixture.componentRef.setInput('hasExistingRota', false);
    fixture.detectChanges();

    const spy = vi.fn();
    component.addDoctorClick.subscribe(spy);

    const addButton = fixture.nativeElement.querySelector('.btn-add-doctor');
    addButton.click();
    expect(spy).toHaveBeenCalled();
  });
});
