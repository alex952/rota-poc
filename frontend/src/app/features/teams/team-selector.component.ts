import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TeamsService } from '../../core/services/teams.service';
import { NotificationService } from '../../core/services/notification.service';
import { extractErrorMessage } from '../../core/http-error';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { TeamNameDialogComponent } from './team-name-dialog.component';

type NameDialog = { mode: 'create' } | { mode: 'rename'; teamId: number; name: string };

/**
 * Desplegable del equipo activo, encima de la lista de médicos, con las acciones para
 * crear, renombrar y borrar equipos. Avisa con `teamSelected` cuando cambia el equipo activo.
 */
@Component({
  selector: 'app-team-selector',
  standalone: true,
  imports: [TeamNameDialogComponent, ConfirmDialogComponent],
  template: `
    <div class="team-selector">
      <label class="team-label" for="team-select">Equipo</label>
      <select
        id="team-select"
        class="team-select"
        [disabled]="disabled()"
        (change)="onSelect($event)"
      >
        @for (team of teamsService.teams(); track team.id) {
          <option [value]="team.id" [selected]="team.id === teamsService.selectedTeamId()">{{ team.name }}</option>
        }
      </select>
      <div class="team-actions">
        <button type="button" class="btn-team btn-new-team" [disabled]="disabled()" (click)="nameDialog.set({ mode: 'create' })">
          + Nuevo
        </button>
        <button type="button" class="btn-team btn-rename-team" [disabled]="disabled() || !selected()" (click)="openRename()">
          Renombrar
        </button>
        <button
          type="button"
          class="btn-team btn-delete-team"
          [disabled]="disabled() || !canDelete()"
          [title]="canDelete() ? '' : 'Debe quedar al menos un equipo'"
          (click)="confirmDelete.set(true)"
        >
          Borrar
        </button>
      </div>
    </div>

    @if (nameDialog(); as dialog) {
      <app-team-name-dialog
        [title]="dialog.mode === 'create' ? 'Nuevo equipo' : 'Renombrar equipo'"
        [submitLabel]="dialog.mode === 'create' ? 'Crear' : 'Guardar'"
        [hint]="dialog.mode === 'create' ? newTeamHint : ''"
        [initialName]="dialog.mode === 'rename' ? dialog.name : ''"
        [error]="nameError()"
        [saving]="saving()"
        (saved)="onNameSaved(dialog, $event)"
        (cancelled)="closeNameDialog()"
      />
    }

    @if (confirmDelete()) {
      <app-confirm-dialog
        title="Borrar equipo"
        confirmLabel="Borrar"
        [message]="deleteMessage()"
        (confirmed)="onConfirmDelete()"
        (cancelled)="confirmDelete.set(false)"
      />
    }
  `,
  styles: [`
    .team-selector {
      padding: 0.75rem;
      border-bottom: 1px solid #e0e0e0;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex-shrink: 0;
    }

    .team-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #555;
    }

    .team-select {
      width: 100%;
      box-sizing: border-box;
      padding: 0.45rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: #1a237e;
      border: 1px solid #9fa8da;
      border-radius: 6px;
      background: #fff;
      text-overflow: ellipsis;
    }

    .team-select:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .team-actions {
      display: flex;
      gap: 0.35rem;
    }

    .btn-team {
      flex: 1;
      padding: 0.3rem 0.25rem;
      font-size: 0.72rem;
      font-weight: 600;
      border: 1px solid #ccc;
      border-radius: 5px;
      background: #fff;
      color: #555;
      cursor: pointer;
      white-space: nowrap;
    }

    .btn-team:hover:not(:disabled) {
      background: #f0f0f0;
      border-color: #999;
    }

    .btn-delete-team:hover:not(:disabled) {
      color: #c62828;
      border-color: #c62828;
    }

    .btn-team:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `],
})
export class TeamSelectorComponent {
  protected readonly teamsService = inject(TeamsService);
  private readonly notificationService = inject(NotificationService);

  readonly disabled = input<boolean>(false);
  readonly teamSelected = output<number>();

  protected readonly nameDialog = signal<NameDialog | null>(null);
  protected readonly nameError = signal('');
  protected readonly saving = signal(false);
  protected readonly confirmDelete = signal(false);

  protected readonly selected = computed(() => this.teamsService.selectedTeam());
  protected readonly canDelete = computed(() => this.teamsService.teams().length > 1);
  protected readonly deleteMessage = computed(
    () =>
      `Se borrará el equipo «${this.selected()?.name ?? ''}» con su lista de médicos y todos sus cuadrantes, de todos los años. Esta acción no se puede deshacer. ¿Desea continuar?`,
  );

  protected readonly newTeamHint =
    'El equipo empezará con la lista inicial de médicos. Para sustituirla, use «Cargar lista» con un fichero JSON o CSV.';

  onSelect(event: Event): void {
    this.teamSelected.emit(Number((event.target as HTMLSelectElement).value));
  }

  openRename(): void {
    const team = this.selected();
    if (team) {
      this.nameDialog.set({ mode: 'rename', teamId: team.id, name: team.name });
    }
  }

  closeNameDialog(): void {
    this.nameDialog.set(null);
    this.nameError.set('');
  }

  onNameSaved(dialog: NameDialog, name: string): void {
    this.saving.set(true);
    this.nameError.set('');
    const request =
      dialog.mode === 'create' ? this.teamsService.create(name) : this.teamsService.rename(dialog.teamId, name);
    request.subscribe({
      next: (team) => {
        this.saving.set(false);
        this.closeNameDialog();
        if (dialog.mode === 'create') {
          this.notificationService.show(`Equipo «${team.name}» creado`, 'success');
          this.teamSelected.emit(team.id);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.nameError.set(
          extractErrorMessage(err, dialog.mode === 'create' ? 'No se ha podido crear el equipo' : 'No se ha podido renombrar el equipo'),
        );
      },
    });
  }

  onConfirmDelete(): void {
    this.confirmDelete.set(false);
    const team = this.selected();
    if (!team) return;
    this.teamsService.delete(team.id).subscribe({
      next: () => {
        this.notificationService.show(`Equipo «${team.name}» borrado`, 'success');
        const next = this.teamsService.teams()[0];
        if (next) {
          this.teamSelected.emit(next.id);
        }
      },
      error: (err) => {
        this.notificationService.show(extractErrorMessage(err, 'No se ha podido borrar el equipo'), 'error');
      },
    });
  }
}
