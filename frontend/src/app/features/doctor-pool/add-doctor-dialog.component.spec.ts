import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddDoctorDialogComponent } from './add-doctor-dialog.component';

describe('AddDoctorDialogComponent', () => {
  let component: AddDoctorDialogComponent;
  let fixture: ComponentFixture<AddDoctorDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddDoctorDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AddDoctorDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should have name and department input fields', () => {
    const nameInput = fixture.nativeElement.querySelector('input[formControlName="name"]');
    const deptInput = fixture.nativeElement.querySelector('input[formControlName="department"]');

    expect(nameInput).toBeTruthy();
    expect(deptInput).toBeTruthy();
  });

  it('should emit doctor data on submit', () => {
    const spy = vi.fn();
    component.doctorAdded.subscribe(spy);

    // Fill in the form
    component.form.controls['name'].setValue('Dr. Fernandez');
    component.form.controls['department'].setValue('Neurologia');
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
    submitButton.click();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Dr. Fernandez',
        department: 'Neurologia',
      })
    );
    // Verify an id was generated
    expect(spy.mock.calls[0][0].id).toBeTruthy();
  });

  it('should validate that name is required', () => {
    component.form.controls['name'].setValue('');
    component.form.controls['department'].setValue('Neurologia');
    fixture.detectChanges();

    expect(component.form.valid).toBe(false);

    // Submit button should not emit when form is invalid
    const spy = vi.fn();
    component.doctorAdded.subscribe(spy);

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
    submitButton.click();
    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
  });

  it('should emit cancel event when cancel clicked', () => {
    const spy = vi.fn();
    component.cancelled.subscribe(spy);

    const cancelButton = fixture.nativeElement.querySelector('.btn-cancel');
    cancelButton.click();

    expect(spy).toHaveBeenCalled();
  });
});
