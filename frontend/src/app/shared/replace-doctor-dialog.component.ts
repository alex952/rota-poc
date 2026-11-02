import { Component, input, output } from '@angular/core';
import { DoctorRef } from '../core/models/rota.model';
import { RotaType } from '../core/models/doctor.model';

export interface ReplaceDoctorChoice {
  doctor_id: string;
  doctor_name: string;
  /** Cuadrante en el que está el médico saliente */
  rota_type: RotaType;
}

/** Refuerzo del día con el grupo que lo cubre: el bloque de refuerzo es común a AC y AP */
export interface DayRefuerzo {
  doctor: DoctorRef;
  rotaType: RotaType;
}

@Component({
  selector: 'app-replace-doctor-dialog',
  standalone: true,
  template: `
    <div class="replace-doctor-backdrop">
      <div class="replace-doctor-dialog">
        <p class="dialog-title">Asignar a {{ doctorName() }} el {{ date() }}</p>
        <p class="dialog-subtitle">Elija cómo desea asignarlo</p>
        <div class="doctor-buttons">
          @if (guardia(); as doc) {
            <button
              class="btn-doctor"
              data-testid="replace-guardia-option"
              (click)="choose(doc, rotaType())"
            >Sustituir a {{ doc.doctor_name }} en la guardia {{ rotaType() }}</button>
          }
          @for (ref of refuerzos(); track ref.doctor.doctor_id) {
            <button
              class="btn-doctor"
              data-testid="replace-refuerzo-option"
              (click)="choose(ref.doctor, ref.rotaType)"
            >Sustituir a {{ ref.doctor.doctor_name }}{{ ref.rotaType === 'AC' ? ' (AC)' : '' }} en el refuerzo</button>
          }
          <button class="btn-add" data-testid="add-doctor-option" (click)="added.emit()">Añadir al refuerzo</button>
        </div>
        <div class="dialog-actions">
          <button class="btn-cancel" (click)="cancelled.emit()">Cancelar</button>
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

    .btn-add {
      display: block;
      width: 100%;
      padding: 0.65rem 0.75rem;
      border: 2px solid #1565c0;
      border-radius: 6px;
      background: #1565c0;
      color: #fff;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
      transition: background-color 0.15s ease;
    }

    .btn-add:hover {
      background: #0d47a1;
    }


    .btn-doctor {
      overflow-wrap: anywhere;
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
  /** Grupo del médico arrastrado: su guardia es la única que puede sustituir */
  readonly rotaType = input.required<RotaType>();
  /** Guardia de su grupo ese día; null si no hay ninguna que sustituir */
  readonly guardia = input<DoctorRef | null>(null);
  /** Todos los refuerzos del día, de AP y de AC */
  readonly refuerzos = input<DayRefuerzo[]>([]);

  readonly selected = output<ReplaceDoctorChoice>();
  readonly added = output<void>();
  readonly cancelled = output<void>();

  protected choose(doctor: DoctorRef, rotaType: RotaType): void {
    this.selected.emit({ doctor_id: doctor.doctor_id, doctor_name: doctor.doctor_name, rota_type: rotaType });
  }
}
