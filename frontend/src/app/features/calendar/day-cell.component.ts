import { Component, computed, input, output } from '@angular/core';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { MergedDayAssignment, DoctorRef } from '../../core/models/rota.model';
import { Doctor } from '../../core/models/doctor.model';

export interface ReplacementEvent {
  date: string;
  newDoctor: Doctor;
  acDoctors: DoctorRef[];
  apDoctors: DoctorRef[];
}

export interface DayContextMenuEvent {
  date: string;
  dayType: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-day-cell',
  standalone: true,
  imports: [CdkDropList],
  template: `
    <div
      class="day-cell"
      [class.day-weekday]="effectiveDayType() === 'weekday'"
      [class.day-saturday]="effectiveDayType() === 'saturday'"
      [class.day-holiday]="effectiveDayType() === 'holiday'"
      [class.day-holiday-manual]="effectiveDayType() === 'holiday-manual'"
      [class.day-holiday-special]="effectiveDayType() === 'holiday-special'"
      [attr.title]="effectiveDayType() === 'holiday-special' ? 'Festivo especial de sanidad' : null"
      [class.drop-target]="assignment() !== null"
      [class.zoomable]="zoomable()"
      cdkDropList
      (click)="onDayClick()"
      (contextmenu)="onDayRightClick($event)"
      (cdkDropListDropped)="onDrop($event)"
      [cdkDropListEnterPredicate]="canDrop"
    >
      <span class="day-number">{{ day() }}</span>
      @if (assignment()) {
        <div class="assignments" data-testid="day-assignments">
          @if (acGuardias().length > 0) {
            <div class="ac-section" title="Atención Continuada">
              <span class="section-header">AC</span>
              @for (doc of acGuardias(); track doc.doctor_id) {
                <span class="doctor-pill clickable" (click)="onDoctorClick($event, doc)">{{ doc.doctor_name }}</span>
              }
            </div>
          }
          @if (apGuardias().length > 0) {
            <div class="ap-section" title="Atención Primaria">
              <span class="section-header">AP</span>
              @for (doc of apGuardias(); track doc.doctor_id) {
                <span class="doctor-pill clickable" (click)="onDoctorClick($event, doc)">{{ doc.doctor_name }}</span>
              }
            </div>
          }
          @if (refuerzos().length > 0) {
            <div class="refuerzo-section" title="Refuerzos del día">
              <span class="section-header">REFUERZO</span>
              @for (ref of refuerzos(); track ref.doctor.doctor_id) {
                <span
                  class="doctor-pill refuerzo clickable"
                  [class.refuerzo-ac]="ref.fromAc"
                  [class.refuerzo-ap]="!ref.fromAc"
                  [attr.title]="ref.fromAc ? 'Refuerzo de un médico AC para completar sus horas del mes' : null"
                  (click)="onDoctorClick($event, ref.doctor)"
                >{{ ref.doctor.doctor_name }}@if (ref.fromAc) { (AC)}</span>
              }
            </div>
          }
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
      display: flex;
      flex-direction: column;
      padding: 4px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 0.75rem;
      background: #fff;
      transition: background-color 0.15s ease;
      overflow: hidden;
      min-height: 0;
      position: relative;
    }

    .day-cell:hover {
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    }

    .day-cell.zoomable {
      cursor: zoom-in;
    }

    .day-cell.drop-target {
      cursor: pointer;
    }

    .day-cell.drop-target.zoomable {
      cursor: zoom-in;
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

    .day-holiday-manual {
      background: #f8bbd0;
    }

    /* outline y no box-shadow: el box-shadow de :hover lo taparía */
    .day-holiday-special {
      background: #f3e5f5;
      outline: 2px solid #8e24aa;
      outline-offset: -2px;
    }

    .day-holiday-special .day-number::after {
      content: '★';
      position: absolute;
      top: -1px;
      right: 2px;
      font-size: 0.7rem;
      color: #8e24aa;
    }

    .day-holiday-manual .day-number::after {
      content: '';
      position: absolute;
      top: 2px;
      right: 2px;
      width: 6px;
      height: 6px;
      background: #c62828;
      border-radius: 50%;
    }

    .day-number {
      display: block;
      font-weight: 600;
      font-size: 0.8rem;
      color: #333;
      margin-bottom: 1px;
      position: relative;
    }

    .assignments {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      scrollbar-gutter: stable;
      padding-right: 2px;
    }

    /* Compacto: en los meses de seis semanas cabe un día con dos refuerzos sin scroll */
    .ac-section,
    .ap-section,
    .refuerzo-section {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: 1px 3px;
      border-radius: 3px;
    }

    .section-header {
      font-weight: 700;
      font-size: 0.6rem;
      line-height: 1.15;
      opacity: 0.7;
      letter-spacing: 0.03em;
    }

    .ac-section {
      background: #e3f2fd;
    }

    .ac-section .section-header {
      color: #1565c0;
    }

    .ap-section {
      background: #e8f5e9;
    }

    .ap-section .section-header {
      color: #2e7d32;
    }

    .doctor-pill {
      display: inline-block;
      font-size: 0.6rem;
      font-weight: 500;
      padding: 1px 5px;
      border-radius: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      line-height: 1.3;
    }

    .ac-section .doctor-pill {
      background: #bbdefb;
      color: #0d47a1;
    }

    .ap-section .doctor-pill {
      background: #c8e6c9;
      color: #1b5e20;
    }

    .refuerzo-section {
      background: #fff3e0;
    }

    .refuerzo-section .section-header {
      color: #e65100;
    }

    /* Cada refuerzo conserva el color de su grupo: verde AP, azul AC */
    .refuerzo-section .doctor-pill.refuerzo-ap {
      background: #c8e6c9;
      color: #1b5e20;
    }

    .refuerzo-section .doctor-pill.refuerzo-ac {
      background: #bbdefb;
      color: #0d47a1;
    }

    .refuerzo-section .doctor-pill.refuerzo::before {
      content: 'R: ';
      font-weight: 700;
      opacity: 0.75;
    }

    .doctor-pill.clickable {
      cursor: pointer;
      transition: filter 0.12s ease;
    }

    .doctor-pill.clickable:hover {
      filter: brightness(0.9);
    }

  `],
})
export class DayCellComponent {
  readonly day = input.required<number>();
  readonly assignment = input<MergedDayAssignment | null>(null);
  readonly dayType = input<string>('weekday');
  readonly date = input<string>('');
  readonly zoomable = input<boolean>(true);
  readonly isManualHoliday = input<boolean>(false);
  readonly isSpecialHoliday = input<boolean>(false);

  readonly doctorDropped = output<ReplacementEvent>();
  readonly doctorClicked = output<{ doctor_id: string; doctor_name: string }>();
  readonly daySelected = output<string>();
  readonly dayContextMenu = output<DayContextMenuEvent>();

  readonly acGuardias = computed(() =>
    (this.assignment()?.acDoctors ?? []).filter((doctor) => doctor.role !== 'refuerzo'),
  );

  readonly apGuardias = computed(() =>
    (this.assignment()?.apDoctors ?? []).filter((doctor) => doctor.role !== 'refuerzo'),
  );

  /** Refuerzos del día: primero los AP y después los que cubre un médico AC */
  readonly refuerzos = computed(() => {
    const assignment = this.assignment();
    if (!assignment) return [];
    return [
      ...assignment.apDoctors
        .filter((doctor) => doctor.role === 'refuerzo')
        .map((doctor) => ({ doctor, fromAc: false })),
      ...assignment.acDoctors
        .filter((doctor) => doctor.role === 'refuerzo')
        .map((doctor) => ({ doctor, fromAc: true })),
    ];
  });

  readonly effectiveDayType = computed<string>(() => {
    if (this.isSpecialHoliday()) {
      return 'holiday-special';
    }
    if (this.isManualHoliday()) {
      return 'holiday-manual';
    }
    return this.dayType();
  });

  canDrop = (): boolean => {
    return this.assignment() !== null;
  };

  onDoctorClick(event: MouseEvent, doctor: { doctor_id: string; doctor_name: string }): void {
    event.stopPropagation();
    this.doctorClicked.emit(doctor);
  }

  onDayClick(): void {
    if (!this.zoomable() || !this.date()) return;
    this.daySelected.emit(this.date());
  }

  onDayRightClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.date()) return;
    this.dayContextMenu.emit({
      date: this.date(),
      dayType: this.effectiveDayType(),
      x: event.clientX,
      y: event.clientY,
    });
  }

  onDrop(event: CdkDragDrop<any>): void {
    const currentAssignment = this.assignment();
    if (!currentAssignment) return;

    const droppedDoctor = event.item.data as Doctor;
    if (!droppedDoctor) return;

    this.doctorDropped.emit({
      date: currentAssignment.date,
      newDoctor: droppedDoctor,
      acDoctors: currentAssignment.acDoctors,
      apDoctors: currentAssignment.apDoctors,
    });
  }
}
