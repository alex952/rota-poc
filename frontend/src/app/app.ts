import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DoctorPoolComponent } from './features/doctor-pool/doctor-pool.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { StatsPanelComponent } from './features/stats/stats-panel.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog.component';
import { ReplaceDoctorDialogComponent, ReplaceDoctorChoice } from './shared/replace-doctor-dialog.component';
import { NotificationComponent } from './shared/notification.component';
import { ConfigService } from './core/services/config.service';
import { RotaService } from './core/services/rota.service';
import { DoctorPoolService } from './core/services/doctor-pool.service';
import { NotificationService } from './core/services/notification.service';
import { Doctor, RotaType } from './core/models/doctor.model';
import { DayAssignment, DoctorStats, DoctorRef, MergedDayAssignment, RefuerzoAssignment, ReplaceRequest, RotaResponse } from './core/models/rota.model';
import { ReplacementEvent } from './features/calendar/day-cell.component';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';

type ReplaceableAssignment = DoctorRef & {
  assignment_kind: 'primary' | 'refuerzo';
  linked_primary_doctor_id?: string;
};

@Component({
  selector: 'app-root',
  imports: [
    DoctorPoolComponent,
    CalendarComponent,
    StatsPanelComponent,
    ConfirmDialogComponent,
    ReplaceDoctorDialogComponent,
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
  protected readonly activePoolTab = signal<RotaType>('AC');
  protected readonly showStats = signal(false);
  protected readonly showConfirmDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly isGenerating = signal(false);
  protected readonly currentMonth = signal(new Date().getMonth() + 1);

  // Dual rota state
  protected readonly acSchedule = signal<DayAssignment[]>([]);
  protected readonly apSchedule = signal<DayAssignment[]>([]);
  protected readonly acStats = signal<DoctorStats[]>([]);
  protected readonly apStats = signal<DoctorStats[]>([]);
  protected readonly hasAcRota = signal(false);
  protected readonly hasApRota = signal(false);

  // Drag-and-drop replacement state
  protected readonly pendingReplacement = signal<ReplacementEvent | null>(null);

  protected readonly doctors = computed(() => this.doctorPoolService.doctors());

  protected readonly activePoolDoctors = computed(() => {
    const tab = this.activePoolTab();
    return tab === 'AC'
      ? this.doctorPoolService.acDoctors()
      : this.doctorPoolService.apDoctors();
  });

  protected readonly hasExistingRota = computed(() => {
    const tab = this.activePoolTab();
    return tab === 'AC' ? this.hasAcRota() : this.hasApRota();
  });

  protected readonly activeStats = computed(() => {
    const tab = this.activePoolTab();
    return tab === 'AC' ? this.acStats() : this.apStats();
  });

  // Merged schedule for the calendar: combine AC + AP by date
  protected readonly mergedSchedule = computed(() => {
    const acMap = new Map<string, DayAssignment>();
    for (const day of this.acSchedule()) {
      acMap.set(day.date, day);
    }
    const apMap = new Map<string, DayAssignment>();
    for (const day of this.apSchedule()) {
      apMap.set(day.date, day);
    }

    // Union of all dates
    const allDates = new Set([...acMap.keys(), ...apMap.keys()]);
    const merged: MergedDayAssignment[] = [];

    for (const dateStr of [...allDates].sort()) {
      const ac = acMap.get(dateStr);
      const ap = apMap.get(dateStr);
      const ref = ac ?? ap!;
      merged.push({
        date: dateStr,
        day_type: ref.day_type,
        shift_start: ref.shift_start,
        shift_end: ref.shift_end,
        duration_hours: ref.duration_hours,
        acDoctors: ac?.doctors ?? [],
        acRefuerzos: ac?.refuerzos ?? [],
        apDoctors: ap?.doctors ?? [],
      });
    }

    return merged;
  });

  protected readonly hasData = computed(() =>
    this.hasAcRota() || this.hasApRota()
  );

  protected readonly confirmMessage = computed(() =>
    `The current ${this.activePoolTab()} rota for ${this.selectedYear()} will be replaced with a new one. This action cannot be undone. Continue?`
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
    this.loadRotas(this.selectedYear());
  }

  toggleStats(): void {
    this.showStats.update((v) => !v);
  }

  onMonthChange(month: number): void {
    this.currentMonth.set(month);
  }

  onPoolTabChange(tab: RotaType): void {
    this.activePoolTab.set(tab);
  }

  onYearChange(year: number): void {
    this.selectedYear.set(year);
    this.loadRotas(year);
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
    const tab = this.activePoolTab();
    const replaceableDoctors = this.getReplaceableDoctors(tab, event);
    if (replaceableDoctors.length === 0) {
      this.notificationService.show(
        'No valid replacement or refuerzo assignment is available for that doctor on this day.',
        'warning'
      );
      return;
    }
    if (replaceableDoctors.length === 1) {
      this.doReplace(
        tab,
        event.date,
        replaceableDoctors[0].doctor_id,
        event.newDoctor.id,
        replaceableDoctors[0].assignment_kind,
        replaceableDoctors[0].linked_primary_doctor_id,
      );
    } else if (replaceableDoctors.length > 1) {
      this.pendingReplacement.set(event);
    }
  }

  onReplaceDoctorSelected(choice: ReplaceDoctorChoice): void {
    const replacement = this.pendingReplacement();
    if (!replacement) return;
    this.pendingReplacement.set(null);
    this.doReplace(
      this.activePoolTab(),
      replacement.date,
      choice.doctor_id,
      replacement.newDoctor.id,
      choice.assignment_kind,
      choice.linked_primary_doctor_id,
    );
  }

  onCancelReplacement(): void {
    this.pendingReplacement.set(null);
  }

  private doReplace(
    rotaType: RotaType,
    dateStr: string,
    oldDoctorId: string,
    newDoctorId: string,
    assignmentKind: 'primary' | 'refuerzo' = 'primary',
    linkedPrimaryDoctorId?: string,
  ): void {
    const request: ReplaceRequest = {
      date: dateStr,
      old_doctor_id: oldDoctorId,
      new_doctor_id: newDoctorId,
      assignment_kind: assignmentKind,
      linked_primary_doctor_id: linkedPrimaryDoctorId,
    };

    this.loading.set(true);

    this.rotaService.replaceDoctor(this.selectedYear(), rotaType, request).subscribe({
      next: (rota) => {
        this.applyRota(rota);
        this.loading.set(false);
        if (rota.warnings?.length) {
          this.notificationService.show(rota.warnings.join('\n'), 'warning');
        }
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

  private loadRotas(year: number): void {
    this.loading.set(true);
    this.rotaService.getRotas(year).subscribe({
      next: (rotas) => {
        this.acSchedule.set([]);
        this.apSchedule.set([]);
        this.acStats.set([]);
        this.apStats.set([]);
        this.hasAcRota.set(false);
        this.hasApRota.set(false);

        for (const rota of rotas) {
          this.applyRota(rota);
        }
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.acSchedule.set([]);
        this.apSchedule.set([]);
        this.acStats.set([]);
        this.apStats.set([]);
        this.hasAcRota.set(false);
        this.hasApRota.set(false);
        this.loading.set(false);
        if (err.status !== 404) {
          this.notificationService.show(
            this.extractErrorMessage(err, 'Failed to load rota'),
            'error'
          );
        }
      },
    });
  }

  private applyRota(rota: RotaResponse): void {
    if (rota.rota_type === 'AC') {
      this.acSchedule.set(rota.schedule);
      this.acStats.set(rota.stats.doctors);
      this.hasAcRota.set(true);
    } else {
      this.apSchedule.set(rota.schedule);
      this.apStats.set(rota.stats.doctors);
      this.hasApRota.set(true);
    }
  }

  protected getReplaceableDoctors(
    rotaType: RotaType,
    event: ReplacementEvent,
  ): ReplaceableAssignment[] {
    if (rotaType === 'AP') {
      return event.apDoctors.map((doctor) => ({ ...doctor, assignment_kind: 'primary' as const }));
    }

    const canCoverRefuerzo = (event.newDoctor.hours_reduced_per_day ?? 0) === 0;
    const primaryAssignments = event.acDoctors.map((doctor) => ({
      ...doctor,
      assignment_kind: 'primary' as const,
    }));
    const refuerzoAssignments = canCoverRefuerzo
      ? (event.acRefuerzos ?? []).map((refuerzo: RefuerzoAssignment) => ({
          doctor_id: refuerzo.doctor_id,
          doctor_name: `${refuerzo.doctor_name} (refuerzo)`,
          assignment_kind: 'refuerzo' as const,
          linked_primary_doctor_id: refuerzo.linked_primary_doctor_id,
        }))
      : [];
    const missingRefuerzoAssignment = this.getMissingRefuerzoAssignment(event, canCoverRefuerzo);

    return [
      ...primaryAssignments,
      ...refuerzoAssignments,
      ...(missingRefuerzoAssignment ? [missingRefuerzoAssignment] : []),
    ];
  }

  private getMissingRefuerzoAssignment(
    event: ReplacementEvent,
    canCoverRefuerzo: boolean,
  ): ReplaceableAssignment | null {
    if (!canCoverRefuerzo || (event.acRefuerzos ?? []).length > 0 || event.acDoctors.length !== 1) {
      return null;
    }

    const primaryDoctor = event.acDoctors[0];
    if (!this.isReducedHoursDoctor(primaryDoctor.doctor_id) || event.newDoctor.id === primaryDoctor.doctor_id) {
      return null;
    }

    return {
      doctor_id: primaryDoctor.doctor_id,
      doctor_name: `Assign refuerzo for ${primaryDoctor.doctor_name}`,
      assignment_kind: 'refuerzo',
      linked_primary_doctor_id: primaryDoctor.doctor_id,
    };
  }

  private isReducedHoursDoctor(doctorId: string): boolean {
    return (this.doctors().find((doctor) => doctor.id === doctorId)?.hours_reduced_per_day ?? 0) > 0;
  }

  private doGenerateRota(): void {
    const tab = this.activePoolTab();
    const pool = this.doctorPoolService.getDoctorsByType(tab);
    const year = this.selectedYear();
    this.loading.set(true);
    this.isGenerating.set(true);
    this.rotaService.generateRota(year, tab, pool).subscribe({
      next: (rota) => {
        this.applyRota(rota);
        this.loading.set(false);
        this.isGenerating.set(false);
        if (rota.warnings?.length) {
          this.notificationService.show(
            `${tab} rota generated with warnings:\n${rota.warnings.join('\n')}`,
            'warning'
          );
        } else {
          this.notificationService.show(
            `${tab} rota generated successfully for ${year}`,
            'success'
          );
        }
      },
      error: (err) => {
        console.error('Failed to generate rota', err);
        this.loading.set(false);
        this.isGenerating.set(false);
        this.notificationService.show(
          this.extractErrorMessage(err, `Failed to generate ${tab} rota`),
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
