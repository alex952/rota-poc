import { Component, computed, input, output, signal } from '@angular/core';
import { DayCellComponent, ReplacementEvent } from './day-cell.component';
import { MonthViewComponent } from './month-view.component';
import { MergedDayAssignment } from '../../core/models/rota.model';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [MonthViewComponent, DayCellComponent],
  template: `
    <section class="calendar">
      <div class="calendar-header">
        <div class="nav-group">
          @if (viewMode() === 'month') {
            <button class="nav-btn" (click)="prevMonth()" [disabled]="currentMonth() === 1" title="Previous month">&lsaquo;</button>
          } @else {
            <button class="back-btn" (click)="showMonthView()" title="Back to month view">Month view</button>
          }
          <span class="month-label" [class.disabled]="!hasData()" (click)="hasData() && goToCurrentMonth()" [title]="hasData() ? 'Go to current month' : ''">{{ currentMonthName() }} {{ year() }}</span>
          @if (viewMode() === 'month') {
            <button class="nav-btn" (click)="nextMonth()" [disabled]="currentMonth() === 12" title="Next month">&rsaquo;</button>
          } @else {
            <span class="day-view-label">{{ selectedDateLabel() }}</span>
          }
        </div>
        @if (filteredDoctor()) {
          <div class="filter-pill">
            <span class="filter-pill-label">{{ filteredDoctor()!.doctor_name }}</span>
            <button class="filter-pill-clear" (click)="clearFilter()" title="Clear filter">&times;</button>
          </div>
        }
        <div class="year-group">
          <label class="year-label">Year:</label>
          <input
            type="number"
            class="year-input"
            [value]="year()"
            (change)="onYearChange($event)"
            min="2020"
            max="2100"
          />
        </div>
      </div>
      <div class="calendar-body">
        @if (!hasData() && viewMode() === 'month') {
          <div class="no-rota-warning">
            <span class="warning-icon">&#9888;</span>
            <span class="warning-text">No hay rota generada para {{ year() }}. Añade médicos al grupo y haz clic en "Generar Rota".</span>
          </div>
        }
        @if (viewMode() === 'month') {
          <app-month-view
            [month]="currentMonth()"
            [year]="year()"
            [assignments]="currentAssignments()"
            [manualHolidayDates]="manualHolidayDates()"
            [allHolidayDates]="allHolidayDates()"
            (doctorDropped)="doctorDropped.emit($event)"
            (doctorClicked)="onDoctorClicked($event)"
            (daySelected)="showDayView($event)"
            (dayContextMenu)="onDayContextMenu($event)"
          />
        } @else {
          <div class="day-view">
            <div class="day-view-header">
              <h3 class="day-view-title">{{ selectedDateLabel() }}</h3>
              <p class="day-view-subtitle">Detailed assignments for the selected day.</p>
            </div>
            <div class="day-view-content">
              <app-day-cell
                class="day-view-cell"
                [day]="selectedDayNumber()"
                [assignment]="selectedAssignment()"
                [dayType]="selectedDayType()"
                [date]="selectedDate()"
                [zoomable]="false"
                (doctorDropped)="doctorDropped.emit($event)"
                (doctorClicked)="onDoctorClicked($event)"
              />
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .calendar {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .calendar-header {
      padding: 0.5rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e0e0e0;
      background: #fafafa;
    }

    .nav-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }

    .nav-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #fff;
      font-size: 1.2rem;
      font-weight: 600;
      color: #1a237e;
      cursor: pointer;
      transition: all 0.15s ease;
      line-height: 1;
    }

    .nav-btn:hover:not(:disabled) {
      background: #e8eaf6;
      border-color: #1a237e;
    }

    .nav-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .back-btn {
      height: 32px;
      padding: 0 0.75rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #fff;
      font-size: 0.8rem;
      font-weight: 600;
      color: #1a237e;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .back-btn:hover {
      background: #e8eaf6;
      border-color: #1a237e;
    }

    .month-label {
      font-size: 1rem;
      font-weight: 700;
      color: #1a237e;
      min-width: 160px;
      text-align: center;
      cursor: pointer;
      border-radius: 4px;
      padding: 0.15rem 0.4rem;
      transition: background-color 0.15s ease;
    }

    .month-label:hover:not(.disabled) {
      background: #e8eaf6;
    }

    .month-label.disabled {
      cursor: default;
      opacity: 0.5;
    }

    .day-view-label {
      font-size: 0.85rem;
      color: #455a64;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }

    .filter-pill {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.5rem 0.25rem 0.7rem;
      background: #e8eaf6;
      border: 1px solid #c5cae9;
      border-radius: 16px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #1a237e;
    }

    .filter-pill-label {
      white-space: nowrap;
    }

    .filter-pill-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: #c5cae9;
      color: #1a237e;
      font-size: 0.85rem;
      line-height: 1;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .filter-pill-clear:hover {
      background: #9fa8da;
    }

    .year-group {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .year-label {
      font-size: 0.8rem;
      color: #666;
      font-weight: 500;
    }

    .year-input {
      width: 72px;
      padding: 0.3rem 0.5rem;
      font-size: 0.85rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      text-align: center;
    }

    .year-input:focus {
      outline: none;
      border-color: #1a237e;
      box-shadow: 0 0 0 2px rgba(26, 35, 126, 0.12);
    }

    .calendar-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0.75rem;
      min-height: 0;
      overflow: hidden;
    }

    .day-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      gap: 0.75rem;
    }

    .day-view-header {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      background: linear-gradient(135deg, #e8eaf6, #f5f7ff);
      border: 1px solid #d7dcf7;
    }

    .day-view-title {
      margin: 0;
      font-size: 1.05rem;
      color: #1a237e;
    }

    .day-view-subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.85rem;
      color: #607d8b;
    }

    .day-view-content {
      flex: 1;
      display: flex;
      min-height: 0;
    }

    .day-view-cell {
      flex: 1;
      min-height: 0;
    }

    .no-rota-warning {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.5rem;
      background: #fff3e0;
      border: 1px solid #ffcc80;
      border-radius: 6px;
      color: #e65100;
      font-size: 0.8rem;
      font-weight: 500;
      flex-shrink: 0;
    }

    .warning-icon {
      font-size: 1rem;
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f9f9f9;
      border-radius: 6px;
    }

    .empty-state-icon {
      font-size: 3rem;
      margin-bottom: 0.75rem;
      opacity: 0.6;
    }

    .empty-state-message {
      font-size: 1rem;
      font-weight: 600;
      color: #555;
      margin: 0 0 0.25rem;
    }

    .empty-state-hint {
      font-size: 0.85rem;
      color: #888;
      margin: 0;
    }

    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
  `],
})
export class CalendarComponent {
  readonly year = input.required<number>();
  readonly schedule = input<MergedDayAssignment[]>([]);
  readonly hasData = input<boolean>(true);
  readonly manualHolidayDates = input<ReadonlySet<string>>(new Set<string>());
  readonly allHolidayDates = input<ReadonlySet<string>>(new Set<string>());
  readonly yearChange = output<number>();
  readonly doctorDropped = output<ReplacementEvent>();
  readonly doctorFilterChanged = output<string | null>();
  readonly monthChange = output<number>();
  readonly dayContextMenu = output<{ date: string; dayType: string; x: number; y: number }>();

  readonly filteredDoctor = signal<{ doctor_id: string; doctor_name: string } | null>(null);
  readonly currentMonth = signal(new Date().getMonth() + 1);
  readonly viewMode = signal<'month' | 'day'>('month');
  readonly selectedDate = signal('');

  private static readonly MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  readonly currentMonthName = computed(
    () => CalendarComponent.MONTH_NAMES[this.currentMonth() - 1]
  );

  private readonly scheduleByMonth = computed(() => {
    const map = new Map<number, MergedDayAssignment[]>();
    for (let month = 1; month <= 12; month++) {
      map.set(month, []);
    }
    for (const assignment of this.schedule()) {
      const date = new Date(assignment.date + 'T00:00:00');
      const month = date.getMonth() + 1;
      const assignments = map.get(month);
      if (assignments) {
        assignments.push(assignment);
      }
    }
    return map;
  });

  readonly currentAssignments = computed(() => {
    const assignments = this.scheduleByMonth().get(this.currentMonth()) ?? [];
    const filter = this.filteredDoctor();
    if (!filter) return assignments;
    return assignments.filter(
      assignment => assignment.acDoctors.some(doctor => doctor.doctor_id === filter.doctor_id)
        || assignment.apDoctors.some(doctor => doctor.doctor_id === filter.doctor_id)
    );
  });

  readonly selectedAssignment = computed(() => {
    const selectedDate = this.selectedDate();
    if (!selectedDate) return null;
    return this.schedule().find((assignment) => assignment.date === selectedDate) ?? null;
  });

  readonly selectedDayNumber = computed(() => {
    const selectedDate = this.selectedDate();
    if (!selectedDate) return 1;
    return new Date(selectedDate + 'T00:00:00').getDate();
  });

  readonly selectedDayType = computed(() => {
    const assignment = this.selectedAssignment();
    if (assignment) return assignment.day_type;

    const selectedDate = this.selectedDate();
    if (!selectedDate) return 'weekday';

    const date = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) return 'holiday';
    if (dayOfWeek === 6) return 'saturday';
    return 'weekday';
  });

  readonly selectedDateLabel = computed(() => {
    const selectedDate = this.selectedDate();
    if (!selectedDate) return '';
    const date = new Date(selectedDate + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  });

  prevMonth(): void {
    this.currentMonth.update((month) => Math.max(1, month - 1));
    this.viewMode.set('month');
    this.monthChange.emit(this.currentMonth());
  }

  nextMonth(): void {
    this.currentMonth.update((month) => Math.min(12, month + 1));
    this.viewMode.set('month');
    this.monthChange.emit(this.currentMonth());
  }

  onDoctorClicked(doctor: { doctor_id: string; doctor_name: string }): void {
    const current = this.filteredDoctor();
    if (current?.doctor_id === doctor.doctor_id) {
      this.filteredDoctor.set(null);
      this.doctorFilterChanged.emit(null);
    } else {
      this.filteredDoctor.set(doctor);
      this.doctorFilterChanged.emit(doctor.doctor_id);
    }
  }

  goToCurrentMonth(): void {
    this.currentMonth.set(new Date().getMonth() + 1);
    this.viewMode.set('month');
    this.monthChange.emit(this.currentMonth());
  }

  showDayView(date: string): void {
    this.selectedDate.set(date);
    this.viewMode.set('day');
  }

  showMonthView(): void {
    this.viewMode.set('month');
  }

  onDayContextMenu(event: { date: string; dayType: string; x: number; y: number }): void {
    this.dayContextMenu.emit(event);
  }

  clearFilter(): void {
    this.filteredDoctor.set(null);
    this.doctorFilterChanged.emit(null);
  }

  onYearChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= 2020 && value <= 2100) {
      this.viewMode.set('month');
      this.yearChange.emit(value);
    }
  }
}
