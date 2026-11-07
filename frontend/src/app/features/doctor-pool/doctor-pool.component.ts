import { Component, input, output, signal } from '@angular/core';
import { DoctorCardComponent } from './doctor-card.component';
import { AddDoctorDialogComponent } from './add-doctor-dialog.component';
import { Doctor, RotaType } from '../../core/models/doctor.model';
import {
  AssignmentStrategy,
  DEFAULT_STRATEGY,
  GeneratedStrategy,
  STRATEGY_OPTIONS,
  STRATEGY_SHORT_LABELS,
} from '../../core/models/rota.model';
import { CdkDropList } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-doctor-pool',
  standalone: true,
  imports: [DoctorCardComponent, AddDoctorDialogComponent, CdkDropList],
  template: `
    <section class="doctor-pool">
      <h3 class="pool-title">Grupo de médicos</h3>

      <div class="pool-tabs">
        <button
          class="tab-btn"
          [class.tab-active]="activeTab() === 'AC'"
          [class.tab-ac]="activeTab() === 'AC'"
          (click)="onTabClick('AC')"
        >AC</button>
        <button
          class="tab-btn"
          [class.tab-active]="activeTab() === 'AP'"
          [class.tab-ap]="activeTab() === 'AP'"
          (click)="onTabClick('AP')"
        >AP</button>
      </div>

      <div class="doctor-list" cdkDropList>
        @for (doctor of doctors(); track doctor.id) {
          <app-doctor-card [doctor]="doctor" />
        }
      </div>

      @if (showAddDialog()) {
        <app-add-doctor-dialog
          [defaultRotaType]="activeTab()"
          (doctorAdded)="onDoctorAdded($event)"
          (cancelled)="showAddDialog.set(false)"
        />
      }

      <div class="pool-actions">
        <div class="strategy-field">
          <label class="strategy-label" for="strategy-select">Método de asignación</label>
          <select
            id="strategy-select"
            class="strategy-select"
            [disabled]="isLoading()"
            (change)="onStrategyChange($event)"
          >
            @for (option of strategyOptions; track option.value) {
              <option [value]="option.value" [selected]="option.value === strategy()">{{ option.label }}</option>
            }
          </select>
        </div>
        <button class="btn-add-doctor" (click)="onAddDoctorClick()">
          + Añadir médico
        </button>
        <button
          class="btn-generate"
          [class.btn-loading]="isLoading()"
          [disabled]="isLoading()"
          (click)="generateRota.emit()"
        >
          @if (isLoading()) {
            <span class="btn-spinner"></span>
          }
          {{ hasExistingRota() ? 'Regenerar cuadrante' : 'Generar cuadrante' }}
        </button>
        @if (generatedStrategy(); as generated) {
          <p class="generated-with">Generado con: {{ shortLabels[generated] }}</p>
        }
      </div>
    </section>
  `,
  styles: [`
    .doctor-pool {
      width: 280px;
      min-width: 280px;
      display: flex;
      flex-direction: column;
      border-right: 1px solid #e0e0e0;
      background: #fafafa;
      height: 100%;
      overflow: hidden;
    }

    .pool-title {
      margin: 0;
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      font-weight: 700;
      color: #1a237e;
      border-bottom: 1px solid #e0e0e0;
      background: #e8eaf6;
    }

    .pool-tabs {
      display: flex;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }

    .tab-btn {
      flex: 1;
      padding: 0.55rem;
      font-size: 0.8rem;
      font-weight: 700;
      border: none;
      background: #f5f5f5;
      color: #888;
      cursor: pointer;
      transition: all 0.15s ease;
      border-bottom: 3px solid transparent;
    }

    .tab-btn:hover {
      background: #eee;
    }

    .tab-btn.tab-active.tab-ac {
      background: #e3f2fd;
      color: #1565c0;
      border-bottom-color: #1565c0;
    }

    .tab-btn.tab-active.tab-ap {
      background: #e8f5e9;
      color: #2e7d32;
      border-bottom-color: #2e7d32;
    }

    .doctor-list {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding: 0.75rem;
    }

    .pool-actions {
      padding: 0.75rem;
      border-top: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .strategy-field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .strategy-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #555;
    }

    .strategy-select {
      width: 100%;
      box-sizing: border-box;
      padding: 0.45rem;
      font-size: 0.8rem;
      border: 1px solid #bbb;
      border-radius: 6px;
      background: #fff;
      color: #333;
      text-overflow: ellipsis;
    }

    .strategy-select:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .generated-with {
      margin: 0;
      font-size: 0.75rem;
      color: #777;
      text-align: center;
    }

    .btn-add-doctor,
    .btn-generate {
      width: 100%;
      padding: 0.55rem;
      font-size: 0.8rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .btn-add-doctor {
      border: 1px dashed #999;
      background: #fff;
      color: #555;
    }

    .btn-add-doctor:hover {
      background: #f0f0f0;
      border-color: #666;
    }

    .btn-generate {
      border: none;
      background: #1a237e;
      color: #fff;
    }

    .btn-generate:hover:not(:disabled) {
      background: #283593;
    }

    .btn-generate:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .btn-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
    }

    .btn-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: btn-spin 0.6s linear infinite;
      flex-shrink: 0;
    }

    @keyframes btn-spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class DoctorPoolComponent {
  readonly doctors = input.required<Doctor[]>();
  readonly activeTab = input.required<RotaType>();
  readonly hasExistingRota = input<boolean>(false);
  readonly isLoading = input<boolean>(false);
  readonly strategy = input<AssignmentStrategy>(DEFAULT_STRATEGY);
  /** Método con el que se generó el cuadrante de la pestaña activa; null si no hay cuadrante */
  readonly generatedStrategy = input<GeneratedStrategy | null>(null);

  readonly strategyChange = output<AssignmentStrategy>();
  readonly generateRota = output<void>();
  readonly addDoctorClick = output<void>();
  readonly doctorAdded = output<Doctor>();
  readonly poolTabChange = output<RotaType>();

  readonly showAddDialog = signal(false);

  protected readonly strategyOptions = STRATEGY_OPTIONS;
  protected readonly shortLabels = STRATEGY_SHORT_LABELS;

  onStrategyChange(event: Event): void {
    this.strategyChange.emit((event.target as HTMLSelectElement).value as AssignmentStrategy);
  }

  onTabClick(tab: RotaType): void {
    this.poolTabChange.emit(tab);
  }

  onAddDoctorClick(): void {
    this.showAddDialog.set(true);
    this.addDoctorClick.emit();
  }

  onDoctorAdded(doctor: Doctor): void {
    this.showAddDialog.set(false);
    this.doctorAdded.emit(doctor);
  }
}
