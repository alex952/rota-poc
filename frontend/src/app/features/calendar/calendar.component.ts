import { Component, computed, input, output, signal } from '@angular/core';
import { MonthViewComponent } from './month-view.component';
import { ReplacementEvent } from './day-cell.component';
import { DayAssignment } from '../../core/models/rota.model';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [MonthViewComponent],
  template: `
    <section class="calendar">
      <div class="calendar-header">
        <div class="nav-group">
          <button class="nav-btn" (click)="prevMonth()" [disabled]="!hasData() || currentMonth() === 1" title="Previous month">&lsaquo;</button>
          <span class="month-label" [class.disabled]="!hasData()" (click)="hasData() && goToCurrentMonth()" [title]="hasData() ? 'Go to current month' : ''">{{ currentMonthName() }} {{ year() }}</span>
          <button class="nav-btn" (click)="nextMonth()" [disabled]="!hasData() || currentMonth() === 12" title="Next month">&rsaquo;</button>
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
        @if (hasData()) {
          <app-month-view
            [month]="currentMonth()"
            [year]="year()"
            [assignments]="currentAssignments()"
            (doctorDropped)="doctorDropped.emit($event)"
            (doctorClicked)="onDoctorClicked($event)"
          />
        } @else {
          <div class="empty-state">
            <div class="empty-state-icon">&#128197;</div>
            <p class="empty-state-message">No rota generated for {{ year() }}.</p>
            <p class="empty-state-hint">Add doctors to the pool and click Generate Rota.</p>
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
  readonly schedule = input<DayAssignment[]>([]);
  readonly hasData = input<boolean>(true);
  readonly yearChange = output<number>();
  readonly doctorDropped = output<ReplacementEvent>();
  readonly doctorFilterChanged = output<string | null>();

  readonly filteredDoctor = signal<{ doctor_id: string; doctor_name: string } | null>(null);

  readonly currentMonth = signal(new Date().getMonth() + 1);

  private static readonly MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  readonly currentMonthName = computed(
    () => CalendarComponent.MONTH_NAMES[this.currentMonth() - 1]
  );

  private readonly scheduleByMonth = computed(() => {
    const map = new Map<number, DayAssignment[]>();
    for (let m = 1; m <= 12; m++) {
      map.set(m, []);
    }
    for (const a of this.schedule()) {
      const date = new Date(a.date + 'T00:00:00');
      const month = date.getMonth() + 1;
      const arr = map.get(month);
      if (arr) {
        arr.push(a);
      }
    }
    return map;
  });

  readonly currentAssignments = computed(() => {
    const assignments = this.scheduleByMonth().get(this.currentMonth()) ?? [];
    const filter = this.filteredDoctor();
    if (!filter) return assignments;
    return assignments.filter(
      a => a.atencion_continuada.doctor_id === filter.doctor_id
        || a.atencion_primaria.doctor_id === filter.doctor_id
    );
  });

  prevMonth(): void {
    this.currentMonth.update(m => Math.max(1, m - 1));
  }

  nextMonth(): void {
    this.currentMonth.update(m => Math.min(12, m + 1));
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
  }

  clearFilter(): void {
    this.filteredDoctor.set(null);
    this.doctorFilterChanged.emit(null);
  }

  onYearChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= 2020 && value <= 2100) {
      this.yearChange.emit(value);
    }
  }
}
