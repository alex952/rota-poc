import { Component, input, output } from '@angular/core';
import { DoctorRef } from '../core/models/rota.model';

export interface ReplaceDoctorChoice {
  doctor_id: string;
  doctor_name: string;
}

@Component({
  selector: 'app-replace-doctor-dialog',
  standalone: true,
  template: `
    <div class="replace-doctor-backdrop">
      <div class="replace-doctor-dialog">
        <p class="dialog-title">Assign {{ doctorName() }} on {{ date() }}</p>
        <p class="dialog-subtitle">
          Choose the assignment to update
        </p>
        <div class="doctor-buttons">
          @for (doc of doctors(); track doc.doctor_id) {
            <button class="btn-doctor" (click)="selected.emit({ doctor_id: doc.doctor_id, doctor_name: doc.doctor_name })">
              {{ doc.doctor_name }}
            </button>
          }
        </div>
        <div class="dialog-actions">
          <button class="btn-cancel" (click)="cancelled.emit()">Cancel</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .replace-doctor-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .replace-doctor-dialog {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      max-width: 380px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .dialog-title {
      margin: 0 0 0.25rem;
      font-size: 0.95rem;
      font-weight: 600;
      color: #333;
    }

    .dialog-subtitle {
      margin: 0 0 1rem;
      font-size: 0.8rem;
      color: #666;
    }

    .doctor-buttons {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .btn-doctor {
      padding: 0.65rem 0.75rem;
      border: 2px solid #1565c0;
      border-radius: 6px;
      background: #e3f2fd;
      color: #1565c0;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
      transition: background-color 0.15s ease;
    }

    .btn-doctor:hover {
      background: #bbdefb;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
    }

    .btn-cancel {
      padding: 0.4rem 1rem;
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
  `],
})
export class ReplaceDoctorDialogComponent {
  readonly date = input.required<string>();
  readonly doctorName = input.required<string>();
  readonly doctors = input.required<DoctorRef[]>();

  readonly selected = output<ReplaceDoctorChoice>();
  readonly cancelled = output<void>();
}
