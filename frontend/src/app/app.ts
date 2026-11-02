import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DoctorPoolComponent } from './features/doctor-pool/doctor-pool.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { StatsPanelComponent } from './features/stats/stats-panel.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog.component';
import { ReplaceDoctorDialogComponent, ReplaceDoctorChoice } from './shared/replace-doctor-dialog.component';
import { DayContextMenuComponent } from './shared/day-context-menu.component';
import { NotificationComponent } from './shared/notification.component';
import { ConfigService } from './core/services/config.service';
import { RotaService } from './core/services/rota.service';
import { HolidaysService } from './core/services/holidays.service';
import { DoctorPoolService } from './core/services/doctor-pool.service';
import { NotificationService } from './core/services/notification.service';
import { Doctor, RotaType } from './core/models/doctor.model';
import { AssignmentStrategy, DEFAULT_STRATEGY, DayAssignment, DoctorStats, DoctorRef, MergedDayAssignment, ReplaceRequest, RotaResponse } from './core/models/rota.model';
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
    ReplaceDoctorDialogComponent,
    DayContextMenuComponent,
    NotificationComponent,
    CdkDropListGroup,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly configService = inject(ConfigService);
  private readonly rotaService = inject(RotaService);
  private readonly holidaysService = inject(HolidaysService);
  private readonly doctorPoolService = inject(DoctorPoolService);
  private readonly notificationService = inject(NotificationService);

  protected readonly city = signal('');
  protected readonly selectedYear = signal(new Date().getFullYear());
  protected readonly activePoolTab = signal<RotaType>('AC');
  protected readonly showStats = signal(false);
  protected readonly showConfirmDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly isGenerating = signal(false);
  protected readonly exporting = signal(false);
  protected readonly currentMonth = signal(new Date().getMonth() + 1);

  protected readonly contextMenuOpen = signal(false);
  protected readonly contextMenuPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  protected readonly contextMenuDate = signal('');
  protected readonly contextMenuDayType = signal('');

  readonly manualHolidayDates = computed(() => this.holidaysService.manualHolidayDates());
  readonly allHolidayDates = computed(() => this.holidaysService.allHolidayDates());
  readonly specialHolidayDates = computed(() => this.holidaysService.specialHolidayDates());

  // Dual rota state
  protected readonly acSchedule = signal<DayAssignment[]>([]);
  protected readonly apSchedule = signal<DayAssignment[]>([]);
  protected readonly acStats = signal<DoctorStats[]>([]);
  protected readonly apStats = signal<DoctorStats[]>([]);
  protected readonly hasAcRota = signal(false);
  protected readonly hasApRota = signal(false);

  // Método de asignación: selección global y método con el que se generó cada cuadrante
  protected readonly selectedStrategy = signal<AssignmentStrategy>(DEFAULT_STRATEGY);
  protected readonly acStrategy = signal<AssignmentStrategy>(DEFAULT_STRATEGY);
  protected readonly apStrategy = signal<AssignmentStrategy>(DEFAULT_STRATEGY);
  protected readonly generatedStrategy = computed<AssignmentStrategy | null>(() => {
    if (this.hasAcRota()) return this.acStrategy();
    if (this.hasApRota()) return this.apStrategy();
    return null;
  });

  // Drag-and-drop replacement state
  protected readonly pendingReplacement = signal<ReplacementEvent | null>(null);

  protected readonly activePoolDoctors = computed(() => {
    const tab = this.activePoolTab();
    return tab === 'AC'
      ? this.doctorPoolService.acDoctors()
      : this.doctorPoolService.apDoctors();
  });

  // Se generan juntos: basta con que exista uno para pedir confirmación.
  protected readonly hasExistingRota = computed(() => this.hasAcRota() || this.hasApRota());

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
        apDoctors: ap?.doctors ?? [],
      });
    }

    return merged;
  });

  protected readonly hasData = computed(() =>
    this.hasAcRota() || this.hasApRota()
  );

  protected readonly confirmMessage = computed(() =>
    `Los cuadrantes AC y AP actuales de ${this.selectedYear()} se sustituirán por unos nuevos. Esta acción no se puede deshacer. ¿Desea continuar?`
  );

  ngOnInit(): void {
    this.doctorPoolService.loadDoctors();
    this.configService.getConfig().subscribe({
      next: (config) => {
        this.city.set(config.city);
        this.holidaysService.loadHolidays(this.selectedYear());
      },
      error: (err) => {
        console.error('Failed to load config', err);
        this.notificationService.show(
          this.extractErrorMessage(err, 'No se ha podido cargar la configuración de la aplicación'),
          'error'
        );
      },
    });
    this.loadRotas(this.selectedYear());
  }

  toggleStats(): void {
    this.showStats.update((v) => !v);
  }

  onExportRota(): void {
    const year = this.selectedYear();
    this.exporting.set(true);
    this.rotaService.exportRotas(year).subscribe({
      next: (blob) => {
        this.downloadBlob(blob, `cuadrante-guardias-${year}.xlsx`);
        this.exporting.set(false);
      },
      error: async (err: HttpErrorResponse) => {
        console.error('Failed to export rota', err);
        // Con responseType 'blob' el cuerpo del error también llega como Blob
        const body = await this.parseBlobError(err);
        this.exporting.set(false);
        this.notificationService.show(
          this.extractErrorMessage({ error: body }, 'No se ha podido exportar el cuadrante'),
          'error'
        );
      },
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private async parseBlobError(err: HttpErrorResponse): Promise<unknown> {
    try {
      return JSON.parse(await (err.error as Blob).text());
    } catch {
      return undefined;
    }
  }

  onMonthChange(month: number): void {
    this.currentMonth.set(month);
  }

  onDayContextMenu(event: { date: string; dayType: string; x: number; y: number }): void {
    this.contextMenuDate.set(event.date);
    this.contextMenuDayType.set(event.dayType);
    this.contextMenuPosition.set({ x: event.x, y: event.y });
    this.contextMenuOpen.set(true);
  }

  onCloseContextMenu(): void {
    this.contextMenuOpen.set(false);
  }

  onContextMenuAction(event: { action: 'mark' | 'unmark'; date: string }): void {
    const date = event.date;
    const year = this.selectedYear();
    this.contextMenuOpen.set(false);

    if (event.action === 'mark') {
      this.holidaysService.markHoliday(year, date, 'Festivo Manual').subscribe({
        next: () => {
          this.notificationService.show(
            `El día ${date} se ha marcado como festivo manual. Los cuadrantes existentes pueden no reflejar este cambio. Regenere el cuadrante para actualizar las asignaciones.`,
            'warning'
          );
        },
        error: (err) => {
          this.notificationService.show(
            this.extractErrorMessage(err, 'Error al marcar festivo manual'),
            'error'
          );
        },
      });
    } else {
      this.holidaysService.unmarkHoliday(year, date).subscribe({
        next: () => {
          this.notificationService.show(
            `El día ${date} ya no es festivo manual. Los cuadrantes existentes pueden no reflejar este cambio. Regenere el cuadrante para actualizar las asignaciones.`,
            'warning'
          );
        },
        error: (err) => {
          this.notificationService.show(
            this.extractErrorMessage(err, 'Error al desmarcar festivo manual'),
            'error'
          );
        },
      });
    }
  }

  onPoolTabChange(tab: RotaType): void {
    this.activePoolTab.set(tab);
  }

  onYearChange(year: number): void {
    this.selectedYear.set(year);
    this.holidaysService.loadHolidays(year);
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
    const assignedDoctors = this.getReplaceableDoctors(this.activePoolTab(), event);
    if (assignedDoctors.length === 0) {
      this.notificationService.show(
        'No hay ninguna sustitución disponible para ese médico en este día.',
        'warning'
      );
      return;
    }
    if (assignedDoctors.some((doctor) => doctor.doctor_id === event.newDoctor.id)) {
      this.notificationService.show(
        'Ese médico ya está asignado a la guardia de este día.',
        'warning'
      );
      return;
    }
    this.pendingReplacement.set(event);
  }

  onAddDoctorToDay(): void {
    const pending = this.pendingReplacement();
    if (!pending) return;
    this.pendingReplacement.set(null);
    this.doAdd(this.activePoolTab(), pending.date, pending.newDoctor.id);
  }

  onReplaceDoctorSelected(choice: ReplaceDoctorChoice): void {
    const replacement = this.pendingReplacement();
    if (!replacement) return;
    this.pendingReplacement.set(null);
    this.doReplace(this.activePoolTab(), replacement.date, choice.doctor_id, replacement.newDoctor.id);
  }

  onCancelReplacement(): void {
    this.pendingReplacement.set(null);
  }

  private doAdd(rotaType: RotaType, dateStr: string, doctorId: string): void {
    this.loading.set(true);

    this.rotaService
      .addDoctor(this.selectedYear(), rotaType, { date: dateStr, doctor_id: doctorId })
      .subscribe({
        next: (rota) => {
          this.applyRota(rota);
          this.loading.set(false);
          if (rota.warnings?.length) {
            this.notificationService.show(rota.warnings.join('\n'), 'warning');
          }
        },
        error: (err) => {
          console.error('Failed to add doctor', err);
          this.loading.set(false);
          this.notificationService.show(
            this.extractErrorMessage(err, 'No se ha podido añadir al médico'),
            'error'
          );
        },
      });
  }

  private doReplace(
    rotaType: RotaType,
    dateStr: string,
    oldDoctorId: string,
    newDoctorId: string,
  ): void {
    const request: ReplaceRequest = {
      date: dateStr,
      old_doctor_id: oldDoctorId,
      new_doctor_id: newDoctorId,
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
          this.extractErrorMessage(err, 'No se ha podido sustituir al médico'),
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
            this.extractErrorMessage(err, 'No se ha podido cargar el cuadrante'),
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
      this.acStrategy.set(rota.strategy ?? DEFAULT_STRATEGY);
    } else {
      this.apSchedule.set(rota.schedule);
      this.apStats.set(rota.stats.doctors);
      this.hasApRota.set(true);
      this.apStrategy.set(rota.strategy ?? DEFAULT_STRATEGY);
    }
  }

  protected getReplaceableDoctors(
    rotaType: RotaType,
    event: ReplacementEvent,
  ): DoctorRef[] {
    return rotaType === 'AP' ? event.apDoctors : event.acDoctors;
  }

  private doGenerateRota(): void {
    const acPool = this.doctorPoolService.getDoctorsByType('AC');
    const apPool = this.doctorPoolService.getDoctorsByType('AP');
    const year = this.selectedYear();
    this.loading.set(true);
    this.isGenerating.set(true);
    this.rotaService.generateRotas(year, acPool, apPool, this.selectedStrategy()).subscribe({
      next: (rotas) => {
        for (const rota of rotas) {
          this.applyRota(rota);
        }
        this.loading.set(false);
        this.isGenerating.set(false);
        const warnings = rotas.flatMap((rota) =>
          (rota.warnings ?? []).map((warning) => `${rota.rota_type}: ${warning}`),
        );
        if (warnings.length) {
          this.notificationService.show(
            `Cuadrantes AC y AP generados con advertencias:\n${warnings.join('\n')}`,
            'warning'
          );
        } else {
          this.notificationService.show(
            `Cuadrantes AC y AP generados correctamente para ${year}`,
            'success'
          );
        }
      },
      error: (err) => {
        console.error('Failed to generate rota', err);
        this.loading.set(false);
        this.isGenerating.set(false);
        this.notificationService.show(
          this.extractErrorMessage(err, 'No se han podido generar los cuadrantes'),
          'error'
        );
      },
    });
  }

  private extractErrorMessage(err: HttpErrorResponse | any, fallback: string): string {
    const backendMessage = err?.error?.message ?? err?.error?.detail;
    if (typeof backendMessage === 'string' && backendMessage.length > 0) {
      return `${fallback}: ${backendMessage}`;
    }
    if (Array.isArray(backendMessage) && backendMessage.length > 0) {
      return `${fallback}: ${backendMessage.join(', ')}`;
    }
    if (err?.message) {
      return `${fallback}: ${err.message}`;
    }
    return fallback;
  }
}
