import { Component, input } from '@angular/core';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { Doctor } from '../../core/models/doctor.model';

@Component({
  selector: 'app-doctor-card',
  standalone: true,
  imports: [CdkDrag],
  template: `
    <div class="doctor-card" cdkDrag [cdkDragData]="doctor()">
      <div class="doctor-info">
        <strong class="doctor-name">{{ doctor().name }}</strong>
        <span class="doctor-department">{{ doctor().department }}</span>
        @if ((doctor().hours_reduced_per_day ?? 0) > 0) {
          <span class="doctor-meta">Reduced: {{ doctor().hours_reduced_per_day ?? 0 }}h/day</span>
        }
      </div>
      <div class="drag-handle">
        <span class="drag-icon">&#x2630;</span>
      </div>
    </div>
  `,
  styles: [`
    .doctor-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.65rem 0.75rem;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 0.5rem;
      background: #fff;
      cursor: grab;
      transition: box-shadow 0.15s ease, transform 0.1s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }

    .doctor-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    }

    .doctor-card:active {
      cursor: grabbing;
      transform: scale(1.02);
    }

    .doctor-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .doctor-name {
      font-size: 0.85rem;
      color: #1a237e;
    }

    .doctor-department {
      font-size: 0.72rem;
      color: #666;
    }

    .doctor-meta {
      font-size: 0.68rem;
      color: #ad1457;
      font-weight: 600;
    }

    .drag-handle {
      color: #bbb;
      font-size: 1rem;
    }

    .drag-icon {
      user-select: none;
    }

    :host {
      display: block;
    }
  `],
})
export class DoctorCardComponent {
  readonly doctor = input.required<Doctor>();
}
