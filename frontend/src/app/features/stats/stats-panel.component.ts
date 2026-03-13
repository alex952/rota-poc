import { Component, computed, input, output } from '@angular/core';
import { DoctorStatsRowComponent } from './doctor-stats-row.component';
import { DoctorStats } from '../../core/models/rota.model';
import { RotaType } from '../../core/models/doctor.model';

@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [DoctorStatsRowComponent],
  template: `
    <aside class="stats-panel" [class.open]="visible()">
      <div class="stats-header">
        <h3 class="stats-title">{{ activeTab() }} Statistics</h3>
        <button class="btn-close-stats" (click)="closed.emit()" aria-label="Close stats panel">&times;</button>
      </div>
      @if (stats().length > 0) {
        <div class="stats-body">
          @for (doctorStats of stats(); track doctorStats.doctor_id) {
            <app-doctor-stats-row [stats]="doctorStats" [maxHours]="maxHours()" [currentMonth]="currentMonth()" />
          }
        </div>
        @if (hasImbalance()) {
          <div class="equity-warning">
            Imbalance detected: {{ hoursDifference() }}h difference between max and min total hours ({{ imbalancePercent() }}%).
          </div>
        }
        <div class="stats-summary">
          <div class="summary-row">
            <span class="summary-label">Total Hours</span>
            <span class="summary-value">{{ totalHours() }}h</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Average / Doctor</span>
            <span class="summary-value">{{ averageHours() }}h</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Doctors</span>
            <span class="summary-value">{{ stats().length }}</span>
          </div>
        </div>
      } @else {
        <p class="no-stats">No statistics available. Generate a rota first.</p>
      }
    </aside>
  `,
  styles: [`
    :host {
      display: block;
      position: fixed;
      top: 0;
      right: 0;
      height: 100dvh;
      z-index: 100;
      pointer-events: none;
    }

    .stats-panel {
      width: 350px;
      height: 100%;
      background: #fafafa;
      border-left: 1px solid #e0e0e0;
      box-shadow: -4px 0 16px rgba(0, 0, 0, 0.08);
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      pointer-events: auto;
    }

    .stats-panel.open {
      transform: translateX(0);
    }

    .stats-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: #e8eaf6;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }

    .stats-title {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #1a237e;
    }

    .btn-close-stats {
      background: none;
      border: none;
      font-size: 1.3rem;
      color: #1a237e;
      cursor: pointer;
      padding: 0 0.25rem;
      line-height: 1;
      opacity: 0.7;
      transition: opacity 0.15s ease;
    }

    .btn-close-stats:hover {
      opacity: 1;
    }

    .stats-body {
      flex: 1;
      overflow-y: auto;
    }

    .equity-warning {
      padding: 0.6rem 1rem;
      margin: 0;
      background: #fff3e0;
      color: #e65100;
      font-size: 0.75rem;
      font-weight: 600;
      border-top: 1px solid #ffe0b2;
      border-bottom: 1px solid #ffe0b2;
      flex-shrink: 0;
    }

    .stats-summary {
      padding: 0.75rem 1rem;
      background: #e8eaf6;
      border-top: 1px solid #e0e0e0;
      flex-shrink: 0;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.2rem 0;
    }

    .summary-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
    }

    .summary-value {
      font-size: 0.85rem;
      font-weight: 700;
      color: #1a237e;
    }

    .no-stats {
      padding: 1.5rem 1rem;
      font-size: 0.8rem;
      color: #999;
      text-align: center;
    }
  `],
})
export class StatsPanelComponent {
  readonly visible = input<boolean>(false);
  readonly stats = input<DoctorStats[]>([]);
  readonly activeTab = input<RotaType>('AC');
  readonly currentMonth = input<number>(new Date().getMonth() + 1);
  readonly closed = output<void>();

  readonly maxHours = computed(() => {
    const s = this.stats();
    if (s.length === 0) return 0;
    return Math.max(...s.map(d => d.total_hours));
  });

  readonly minHours = computed(() => {
    const s = this.stats();
    if (s.length === 0) return 0;
    return Math.min(...s.map(d => d.total_hours));
  });

  readonly hoursDifference = computed(() => this.maxHours() - this.minHours());

  readonly imbalancePercent = computed(() => {
    const max = this.maxHours();
    if (max === 0) return 0;
    return Math.round((this.hoursDifference() / max) * 100);
  });

  readonly hasImbalance = computed(() => {
    const s = this.stats();
    if (s.length < 2) return false;
    const max = this.maxHours();
    if (max === 0) return false;
    return (this.hoursDifference() / max) > 0.10;
  });

  readonly totalHours = computed(() =>
    this.stats().reduce((sum, d) => sum + d.total_hours, 0),
  );

  readonly averageHours = computed(() => {
    const s = this.stats();
    if (s.length === 0) return 0;
    return Math.round(this.totalHours() / s.length);
  });
}
