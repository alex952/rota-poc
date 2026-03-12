import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DoctorPoolComponent } from './features/doctor-pool/doctor-pool.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { StatsPanelComponent } from './features/stats/stats-panel.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog.component';
import { ServiceTypeDialogComponent, ServiceTypeChoice } from './shared/service-type-dialog.component';
import { NotificationComponent } from './shared/notification.component';
import { ConfigService } from './core/services/config.service';
import { RotaService } from './core/services/rota.service';
import { DoctorPoolService } from './core/services/doctor-pool.service';
import { NotificationService } from './core/services/notification.service';
import { Doctor } from './core/models/doctor.model';
import { DayAssignment, DoctorStats, ReplaceRequest } from './core/models/rota.model';
import { ReplacementEvent } from './features/calendar/day-cell.component';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-root',
  imports: [
    DoctorPoolComponent,
    CalendarComponent,
    StatsPanelComponent,
    ConfirmDialogComponent,
    ServiceTypeDialogComponent,
    NotificationComponent,
    CdkDropListGroup,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly configService = inject(ConfigService);
  private readonly rotaService = inject(RotaService);
  private readonly doctorPoolService = inject(DoctorPoolService);
  private readonly notificationService = inject(NotificationService);

  protected readonly city = signal('');
  protected readonly selectedYear = signal(new Date().getFullYear());
  protected readonly schedule = signal<DayAssignment[]>([]);
  protected readonly stats = signal<DoctorStats[]>([]);
  protected readonly hasExistingRota = signal(false);
  protected readonly showStats = signal(false);
  protected readonly showConfirmDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly isGenerating = signal(false);

  // Drag-and-drop replacement state
  protected readonly pendingReplacement = signal<ReplacementEvent | null>(null);

  protected readonly doctors = computed(() => this.doctorPoolService.doctors());

  protected readonly confirmMessage = computed(() =>
    `The current rota for ${this.selectedYear()} will be replaced with a new one. This action cannot be undone. Continue?`
  );

  ngOnInit(): void {
    this.doctorPoolService.loadDoctors();
    this.configService.getConfig().subscribe({
      next: (config) => this.city.set(config.city),
      error: (err) => {
        console.error('Failed to load config', err);
        this.notificationService.show(
          this.extractErrorMessage(err, 'Failed to load application configuration'),
          'error'
        );
      },
    });
    this.loadRota(this.selectedYear());
  }

  toggleStats(): void {
    this.showStats.update((v) => !v);
  }

  onYearChange(year: number): void {
    this.selectedYear.set(year);
    this.loadRota(year);
  }

  onGenerateRota(): void {
    if (this.hasExistingRota()) {
      this.showConfirmDialog.set(true);
    } else {
      this.doGenerateRota();
    }
  }

  onConfirmRegenerate(): void {
    this.showConfirmDialog.set(false);
    this.doGenerateRota();
  }

  onCancelRegenerate(): void {
    this.showConfirmDialog.set(false);
  }

  onAddDoctor(doctor: Doctor): void {
    this.doctorPoolService.addDoctor(doctor);
  }

  onDoctorDropped(event: ReplacementEvent): void {
    this.pendingReplacement.set(event);
  }

  onServiceTypeSelected(serviceType: ServiceTypeChoice): void {
    const replacement = this.pendingReplacement();
    if (!replacement) return;

    const oldDoctorId = serviceType === 'atencion_continuada'
      ? replacement.acDoctor.doctor_id
      : replacement.apDoctor.doctor_id;

    const request: ReplaceRequest = {
      date: replacement.date,
      service_type: serviceType,
      old_doctor_id: oldDoctorId,
      new_doctor_id: replacement.newDoctor.id,
    };

    this.pendingReplacement.set(null);
    this.loading.set(true);

    this.rotaService.replaceDoctor(this.selectedYear(), request).subscribe({
      next: (rota) => {
        this.schedule.set(rota.schedule);
        this.stats.set(rota.stats.doctors);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to replace doctor', err);
        this.loading.set(false);
        this.notificationService.show(
          this.extractErrorMessage(err, 'Failed to replace doctor'),
          'error'
        );
      },
    });
  }

  onCancelReplacement(): void {
    this.pendingReplacement.set(null);
  }

  private loadRota(year: number): void {
    this.loading.set(true);
    this.rotaService.getRota(year).subscribe({
      next: (rota) => {
        this.schedule.set(rota.schedule);
        this.stats.set(rota.stats.doctors);
        this.hasExistingRota.set(true);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.schedule.set([]);
        this.stats.set([]);
        this.hasExistingRota.set(false);
        this.loading.set(false);
        // 404 is expected when no rota exists — only show notification for real errors
        if (err.status !== 404) {
          this.notificationService.show(
            this.extractErrorMessage(err, 'Failed to load rota'),
            'error'
          );
        }
      },
    });
  }

  private doGenerateRota(): void {
    const pool = this.doctorPoolService.doctors();
    const year = this.selectedYear();
    this.loading.set(true);
    this.isGenerating.set(true);
    this.rotaService.generateRota(year, pool).subscribe({
      next: (rota) => {
        this.schedule.set(rota.schedule);
        this.stats.set(rota.stats.doctors);
        this.hasExistingRota.set(true);
        this.loading.set(false);
        this.isGenerating.set(false);
        if (rota.warnings?.length) {
          this.notificationService.show(
            `Rota generated with warnings:\n${rota.warnings.join('\n')}`,
            'warning'
          );
        } else {
          this.notificationService.show(
            `Rota generated successfully for ${year}`,
            'success'
          );
        }
      },
      error: (err) => {
        console.error('Failed to generate rota', err);
        this.loading.set(false);
        this.isGenerating.set(false);
        this.notificationService.show(
          this.extractErrorMessage(err, 'Failed to generate rota'),
          'error'
        );
      },
    });
  }

  private extractErrorMessage(err: HttpErrorResponse | any, fallback: string): string {
    if (err?.error?.detail) {
      return `${fallback}: ${err.error.detail}`;
    }
    if (err?.message) {
      return `${fallback}: ${err.message}`;
    }
    return fallback;
  }
}
