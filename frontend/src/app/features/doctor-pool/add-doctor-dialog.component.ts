import { Component, inject, input, output } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Doctor, RotaType } from '../../core/models/doctor.model';

@Component({
  selector: 'app-add-doctor-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="add-doctor-dialog">
      <h4 class="dialog-title">Add New Doctor ({{ defaultRotaType() }})</h4>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="form-field">
          <label for="name">Name</label>
          <input id="name" formControlName="name" type="text" placeholder="Dr. Name" />
        </div>
        <div class="form-field">
          <label for="department">Department</label>
          <input id="department" formControlName="department" type="text" placeholder="Department" />
        </div>
        <div class="dialog-actions">
          <button type="button" class="btn-cancel" (click)="cancelled.emit()">Cancel</button>
          <button type="submit" class="btn-submit">Add</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .add-doctor-dialog {
      padding: 0.75rem;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: #f5f5f5;
      margin-bottom: 0.75rem;
    }

    .dialog-title {
      margin: 0 0 0.75rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: #333;
    }

    .form-field {
      margin-bottom: 0.6rem;
    }

    .form-field label {
      display: block;
      font-size: 0.72rem;
      font-weight: 600;
      color: #666;
      margin-bottom: 2px;
    }

    .form-field input {
      width: 100%;
      padding: 0.4rem 0.5rem;
      font-size: 0.8rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-sizing: border-box;
    }

    .form-field input:focus {
      outline: none;
      border-color: #1a237e;
      box-shadow: 0 0 0 2px rgba(26, 35, 126, 0.12);
    }

    .dialog-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      margin-top: 0.75rem;
    }

    .btn-cancel {
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
      color: #666;
      cursor: pointer;
    }

    .btn-cancel:hover {
      background: #f5f5f5;
    }

    .btn-submit {
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      border: none;
      border-radius: 4px;
      background: #1a237e;
      color: #fff;
      cursor: pointer;
    }

    .btn-submit:hover {
      background: #283593;
    }
  `],
})
export class AddDoctorDialogComponent {
  readonly defaultRotaType = input<RotaType>('AC');
  readonly doctorAdded = output<Doctor>();
  readonly cancelled = output<void>();

  private readonly fb = inject(FormBuilder);

  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    department: ['', Validators.required],
  });

  onSubmit(): void {
    if (this.form.valid) {
      const doctor: Doctor = {
        id: `doc-${Date.now()}`,
        name: this.form.value['name'],
        department: this.form.value['department'],
        rota_type: this.defaultRotaType(),
      };
      this.doctorAdded.emit(doctor);
      this.form.reset();
    }
  }
}
