import { Component, input, output, computed } from '@angular/core';
import { DayCellComponent, ReplacementEvent } from './day-cell.component';
import { MergedDayAssignment } from '../../core/models/rota.model';

@Component({
  selector: 'app-month-view',
  standalone: true,
  imports: [DayCellComponent],
  template: `
    <div class="month-view">
      <h3 class="month-header">{{ monthName() }} {{ year() }}</h3>
      <div class="calendar-grid">
        <div class="day-header">Mon</div>
        <div class="day-header">Tue</div>
        <div class="day-header">Wed</div>
        <div class="day-header">Thu</div>
        <div class="day-header">Fri</div>
        <div class="day-header">Sat</div>
        <div class="day-header">Sun</div>
        @for (cell of gridCells(); track cell.key) {
          @if (cell.day === 0) {
            <div class="empty-cell"></div>
          } @else {
            <app-day-cell
              [day]="cell.day"
              [assignment]="cell.assignment"
              [dayType]="cell.dayType"
              [date]="cell.date"
              (doctorDropped)="doctorDropped.emit($event)"
              (doctorClicked)="doctorClicked.emit($event)"
            />
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .month-view {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .month-header {
      font-size: 1rem;
      font-weight: 600;
      color: #1a237e;
      margin: 0 0 0.5rem;
      padding: 0.5rem 0.75rem;
      background: #e8eaf6;
      border-radius: 6px;
      flex-shrink: 0;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      grid-auto-rows: 1fr;
      gap: 2px;
      flex: 1;
      min-height: 0;
    }

    .day-header {
      text-align: center;
      font-weight: 600;
      font-size: 0.75rem;
      color: #666;
      padding: 4px 0;
      background: #f5f5f5;
      border-radius: 3px;
    }

    .empty-cell {
    }
  `],
})
export class MonthViewComponent {
  readonly month = input.required<number>();
  readonly year = input.required<number>();
  readonly assignments = input<MergedDayAssignment[]>([]);

  readonly doctorDropped = output<ReplacementEvent>();
  readonly doctorClicked = output<{ doctor_id: string; doctor_name: string }>();

  private static readonly MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  readonly monthName = computed(() => MonthViewComponent.MONTH_NAMES[this.month() - 1]);

  readonly daysInMonth = computed(() => {
    return new Date(this.year(), this.month(), 0).getDate();
  });

  readonly firstDayOffset = computed(() => {
    const dayOfWeek = new Date(this.year(), this.month() - 1, 1).getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  });

  readonly assignmentsByDay = computed(() => {
    const map = new Map<number, MergedDayAssignment>();
    for (const a of this.assignments()) {
      const date = new Date(a.date + 'T00:00:00');
      if (date.getMonth() + 1 === this.month() && date.getFullYear() === this.year()) {
        map.set(date.getDate(), a);
      }
    }
    return map;
  });

  readonly gridCells = computed(() => {
    const cells: Array<{ key: string; day: number; assignment: MergedDayAssignment | null; dayType: string; date: string }> = [];
    const offset = this.firstDayOffset();
    const total = this.daysInMonth();
    const assignMap = this.assignmentsByDay();

    for (let i = 0; i < offset; i++) {
      cells.push({ key: `empty-${i}`, day: 0, assignment: null, dayType: 'weekday', date: '' });
    }

    for (let d = 1; d <= total; d++) {
      const assignment = assignMap.get(d) ?? null;
      const dayType = assignment ? assignment.day_type : this.getDefaultDayType(d);
      const dateStr = assignment ? assignment.date : this.formatDate(d);
      cells.push({ key: `day-${d}`, day: d, assignment, dayType, date: dateStr });
    }

    return cells;
  });

  private getDefaultDayType(day: number): string {
    const date = new Date(this.year(), this.month() - 1, day);
    const dow = date.getDay();
    if (dow === 0) return 'holiday';
    if (dow === 6) return 'saturday';
    return 'weekday';
  }

  private formatDate(day: number): string {
    const m = this.month().toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    return `${this.year()}-${m}-${d}`;
  }
}
