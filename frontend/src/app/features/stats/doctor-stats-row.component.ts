import { Component, computed, input } from '@angular/core';
import { DoctorStats } from '../../core/models/rota.model';

@Component({
  selector: 'app-doctor-stats-row',
  standalone: true,
  template: `
    <div class="doctor-stats-row">
      <strong class="doctor-name">{{ stats().doctor_name }}</strong>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Total</span>
          <span class="stat-value">{{ stats().total_hours }}h</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">AC</span>
          <span class="stat-value ac">{{ stats().ac_hours }}h</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">AP</span>
          <span class="stat-value ap">{{ stats().ap_hours }}h</span>
        </div>
      </div>
      <div class="hours-bar">
        <div class="hours-bar-fill ac-fill" [style.width.%]="acBarWidth()"></div>
        <div class="hours-bar-fill ap-fill" [style.width.%]="apBarWidth()"></div>
      </div>
      <div class="shifts-row">
        <span class="shift-badge weekday">Wkd: {{ stats().shifts_weekday }}</span>
        <span class="shift-badge saturday">Sat: {{ stats().shifts_saturday }}</span>
        <span class="shift-badge holiday">Hol: {{ stats().shifts_sunday_holiday }}</span>
      </div>
    </div>
  `,
  styles: [`
    .doctor-stats-row {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #eee;
    }

    .doctor-name {
      display: block;
      font-size: 0.85rem;
      color: #1a237e;
      margin-bottom: 0.4rem;
    }

    .stats-grid {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 0.4rem;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .stat-label {
      font-size: 0.65rem;
      font-weight: 600;
      color: #999;
      text-transform: uppercase;
    }

    .stat-value {
      font-size: 0.8rem;
      font-weight: 600;
      color: #333;
    }

    .stat-value.ac {
      color: #1565c0;
    }

    .stat-value.ap {
      color: #2e7d32;
    }

    .hours-bar {
      display: flex;
      height: 6px;
      background: #eee;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 0.4rem;
    }

    .hours-bar-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    .hours-bar-fill.ac-fill {
      background: #1565c0;
    }

    .hours-bar-fill.ap-fill {
      background: #2e7d32;
    }

    .shifts-row {
      display: flex;
      gap: 0.4rem;
    }

    .shift-badge {
      font-size: 0.65rem;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 500;
    }

    .shift-badge.weekday {
      background: #e3f2fd;
      color: #1565c0;
    }

    .shift-badge.saturday {
      background: #fff8e1;
      color: #f57f17;
    }

    .shift-badge.holiday {
      background: #fce4ec;
      color: #c62828;
    }
  `],
})
export class DoctorStatsRowComponent {
  readonly stats = input.required<DoctorStats>();
  readonly maxHours = input<number>(0);

  readonly acBarWidth = computed(() => {
    const max = this.maxHours();
    if (max === 0) return 0;
    return Math.round((this.stats().ac_hours / max) * 100);
  });

  readonly apBarWidth = computed(() => {
    const max = this.maxHours();
    if (max === 0) return 0;
    return Math.round((this.stats().ap_hours / max) * 100);
  });
}
