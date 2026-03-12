import { Component, input, output } from '@angular/core';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { DayAssignment } from '../../core/models/rota.model';
import { Doctor } from '../../core/models/doctor.model';

export interface ReplacementEvent {
  date: string;
  newDoctor: Doctor;
  acDoctor: { doctor_id: string; doctor_name: string };
  apDoctor: { doctor_id: string; doctor_name: string };
}

@Component({
  selector: 'app-day-cell',
  standalone: true,
  imports: [CdkDropList],
  template: `
    <div
      class="day-cell"
      [class.day-weekday]="dayType() === 'weekday'"
      [class.day-saturday]="dayType() === 'saturday'"
      [class.day-holiday]="dayType() === 'holiday'"
      [class.drop-target]="assignment() !== null"
      cdkDropList
      (cdkDropListDropped)="onDrop($event)"
      [cdkDropListEnterPredicate]="canDrop"
    >
      <span class="day-number">{{ day() }}</span>
      @if (assignment()) {
        <div class="assignments">
          <div class="ac-assignment" title="Atencion Continuada">
            <span class="label">AC</span>
            <span class="doctor-name clickable" (click)="onDoctorClick($event, assignment()!.atencion_continuada)">{{ assignment()!.atencion_continuada.doctor_name }}</span>
          </div>
          <div class="ap-assignment" title="Atencion Primaria">
            <span class="label">AP</span>
            <span class="doctor-name clickable" (click)="onDoctorClick($event, assignment()!.atencion_primaria)">{{ assignment()!.atencion_primaria.doctor_name }}</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      min-height: 0;
    }

    .day-cell {
      flex: 1;
      padding: 4px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 0.75rem;
      background: #fff;
      transition: background-color 0.15s ease;
      overflow: hidden;
    }

    .day-cell:hover {
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    }

    .day-cell.drop-target {
      cursor: pointer;
    }

    .day-weekday {
      background: #ffffff;
    }

    .day-saturday {
      background: #fff8e1;
    }

    .day-holiday {
      background: #fce4ec;
    }

    .day-number {
      display: block;
      font-weight: 600;
      font-size: 0.8rem;
      color: #333;
      margin-bottom: 2px;
    }

    .assignments {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .ac-assignment,
    .ap-assignment {
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 1px 3px;
      border-radius: 3px;
      line-height: 1.3;
    }

    .ac-assignment {
      background: #e3f2fd;
      color: #1565c0;
    }

    .ap-assignment {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .label {
      font-weight: 700;
      font-size: 0.65rem;
      flex-shrink: 0;
    }

    .doctor-name {
      font-size: 0.65rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .doctor-name.clickable {
      cursor: pointer;
      border-radius: 2px;
    }

    .doctor-name.clickable:hover {
      text-decoration: underline;
    }
  `],
})
export class DayCellComponent {
  readonly day = input.required<number>();
  readonly assignment = input<DayAssignment | null>(null);
  readonly dayType = input<string>('weekday');
  readonly date = input<string>('');

  readonly doctorDropped = output<ReplacementEvent>();
  readonly doctorClicked = output<{ doctor_id: string; doctor_name: string }>();

  /** Only allow drops on cells that have an existing assignment */
  canDrop = (): boolean => {
    return this.assignment() !== null;
  };

  onDoctorClick(event: MouseEvent, doctor: { doctor_id: string; doctor_name: string }): void {
    event.stopPropagation();
    this.doctorClicked.emit(doctor);
  }

  onDrop(event: CdkDragDrop<any>): void {
    const currentAssignment = this.assignment();
    if (!currentAssignment) return;

    const droppedDoctor = event.item.data as Doctor;
    if (!droppedDoctor) return;

    this.doctorDropped.emit({
      date: currentAssignment.date,
      newDoctor: droppedDoctor,
      acDoctor: currentAssignment.atencion_continuada,
      apDoctor: currentAssignment.atencion_primaria,
    });
  }
}
