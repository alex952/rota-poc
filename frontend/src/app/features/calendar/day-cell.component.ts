import { Component, computed, input, output } from '@angular/core';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { MergedDayAssignment, DoctorRef, RefuerzoAssignment } from '../../core/models/rota.model';
import { Doctor } from '../../core/models/doctor.model';

export interface ReplacementEvent {
  date: string;
  newDoctor: Doctor;
  acDoctors: DoctorRef[];
  acRefuerzos: RefuerzoAssignment[];
  apDoctors: DoctorRef[];
}

export interface DayContextMenuEvent {
  date: string;
  dayType: string;
  x: number;
  y: number;
}

interface AcRenderItem {
  doctor_id: string;
  doctor_name: string;
  reduced: boolean;
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
          @if (acRenderItems().length > 0) {
            <div class="ac-section" title="Atencion Continuada">
              <span class="section-header">AC</span>
              @for (item of acRenderItems(); track item.doctor_id) {
                <span
                  class="doctor-pill clickable"
                  [class.reduced-hours]="item.reduced"
                  (click)="onDoctorClick($event, { doctor_id: item.doctor_id, doctor_name: item.doctor_name })"
                >{{ item.doctor_name }}</span>
              }
            </div>
          }
          @if (assignment()!.apDoctors.length > 0) {
            <div class="ap-section" title="Atencion Primaria (refuerzo del dia)">
              <span class="section-header">AP</span>
              @for (doc of assignment()!.apDoctors; track doc.doctor_id) {
                <span class="doctor-pill ap-refuerzo clickable" (click)="onDoctorClick($event, doc)">{{ doc.doctor_name }}</span>
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
      margin-bottom: 2px;
      position: relative;
    }

    .assignments {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      scrollbar-gutter: stable;
      padding-right: 2px;
    }

    .ac-section,
    .ap-section {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: 2px 3px;
      border-radius: 3px;
    }

    .section-header {
      font-weight: 700;
      font-size: 0.6rem;
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
      line-height: 1.4;
    }

    .ac-section .doctor-pill {
      background: #bbdefb;
      color: #0d47a1;
    }

    .ac-section .doctor-pill.reduced-hours {
      font-style: italic;
    }

    .ap-section .doctor-pill {
      background: #c8e6c9;
      color: #1b5e20;
    }

    .ap-section .doctor-pill.ap-refuerzo::before {
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
  readonly reducedDoctorIds = input<ReadonlySet<string>>(new Set<string>());
  readonly isManualHoliday = input<boolean>(false);

  readonly doctorDropped = output<ReplacementEvent>();
  readonly doctorClicked = output<{ doctor_id: string; doctor_name: string }>();
  readonly daySelected = output<string>();
  readonly dayContextMenu = output<DayContextMenuEvent>();

  readonly effectiveDayType = computed<string>(() => {
    if (this.isManualHoliday()) {
      return 'holiday-manual';
    }
    return this.dayType();
  });

  readonly acRenderItems = computed<AcRenderItem[]>(() => {
    const current = this.assignment();
    if (!current) {
      return [];
    }

    const refuerzos = current.acRefuerzos ?? [];
    const inferredReduced = new Set(
      refuerzos
        .map((refuerzo) => refuerzo.linked_primary_doctor_id)
        .filter((id): id is string => Boolean(id)),
    );
    const externalReduced = this.reducedDoctorIds();

    const reducedPrimaries: AcRenderItem[] = [];
    const otherPrimaries: AcRenderItem[] = [];
    for (const doctor of current.acDoctors) {
      const reduced = inferredReduced.has(doctor.doctor_id) || externalReduced.has(doctor.doctor_id);
      const item: AcRenderItem = {
        doctor_id: doctor.doctor_id,
        doctor_name: doctor.doctor_name,
        reduced,
      };
      if (reduced) {
        reducedPrimaries.push(item);
      } else {
        otherPrimaries.push(item);
      }
    }

    const items: AcRenderItem[] = [];
    const refuerzosByPrimary = new Map<string, RefuerzoAssignment[]>();
    for (const refuerzo of refuerzos) {
      const key = refuerzo.linked_primary_doctor_id;
      if (!refuerzosByPrimary.has(key)) {
        refuerzosByPrimary.set(key, []);
      }
      refuerzosByPrimary.get(key)?.push(refuerzo);
    }

    for (const primary of reducedPrimaries) {
      items.push(primary);
      const linkedRefuerzos = refuerzosByPrimary.get(primary.doctor_id) ?? [];
      for (const refuerzo of linkedRefuerzos) {
        items.push({
          doctor_id: refuerzo.doctor_id,
          doctor_name: refuerzo.doctor_name,
          reduced: false,
        });
      }
    }

    for (const primary of otherPrimaries) {
      items.push(primary);
    }

    return items;
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
      acRefuerzos: currentAssignment.acRefuerzos ?? [],
      apDoctors: currentAssignment.apDoctors,
    });
  }
}
