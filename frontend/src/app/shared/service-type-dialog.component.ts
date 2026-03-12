import { Component, input, output } from '@angular/core';

export type ServiceTypeChoice = 'atencion_continuada' | 'atencion_primaria';

@Component({
  selector: 'app-service-type-dialog',
  standalone: true,
  template: `
    <div class="service-type-backdrop">
      <div class="service-type-dialog">
        <p class="dialog-title">Replace which service on {{ date() }}?</p>
        <p class="dialog-subtitle">
          Replacing with <strong>{{ doctorName() }}</strong>
        </p>
        <div class="service-buttons">
          <button class="btn-ac" (click)="selected.emit('atencion_continuada')">
            <span class="btn-label">AC</span>
            <span class="btn-detail">Atencion Continuada</span>
            <span class="btn-current">Current: {{ acDoctorName() }}</span>
          </button>
          <button class="btn-ap" (click)="selected.emit('atencion_primaria')">
            <span class="btn-label">AP</span>
            <span class="btn-detail">Atencion Primaria</span>
            <span class="btn-current">Current: {{ apDoctorName() }}</span>
          </button>
        </div>
        <div class="dialog-actions">
          <button class="btn-cancel" (click)="cancelled.emit()">Cancel</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .service-type-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .service-type-dialog {
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

    .service-buttons {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .btn-ac, .btn-ap {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      text-align: left;
      transition: background-color 0.15s ease;
    }

    .btn-ac {
      border: 2px solid #1565c0;
      background: #e3f2fd;
      color: #1565c0;
    }

    .btn-ac:hover {
      background: #bbdefb;
    }

    .btn-ap {
      border: 2px solid #2e7d32;
      background: #e8f5e9;
      color: #2e7d32;
    }

    .btn-ap:hover {
      background: #c8e6c9;
    }

    .btn-label {
      font-weight: 700;
      font-size: 0.85rem;
    }

    .btn-detail {
      font-size: 0.75rem;
      opacity: 0.8;
    }

    .btn-current {
      font-size: 0.72rem;
      font-style: italic;
      opacity: 0.7;
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
export class ServiceTypeDialogComponent {
  readonly date = input.required<string>();
  readonly doctorName = input.required<string>();
  readonly acDoctorName = input.required<string>();
  readonly apDoctorName = input.required<string>();

  readonly selected = output<ServiceTypeChoice>();
  readonly cancelled = output<void>();
}
