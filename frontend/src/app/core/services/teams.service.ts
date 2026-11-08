import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Doctor } from '../models/doctor.model';
import { Team } from '../models/team.model';

const SELECTED_TEAM_KEY = 'rota.selectedTeamId';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly http = inject(HttpClient);

  /** Equipos por orden de creación */
  readonly teams = signal<Team[]>([]);
  readonly selectedTeamId = signal<number | null>(null);
  readonly selectedTeam = computed(
    () => this.teams().find((team) => team.id === this.selectedTeamId()) ?? null,
  );

  load(): Observable<Team[]> {
    return this.http.get<Team[]>('/api/v1/teams').pipe(tap((teams) => this.teams.set(teams)));
  }

  create(name: string): Observable<Team> {
    return this.http
      .post<Team>('/api/v1/teams', { name })
      .pipe(tap((team) => this.teams.update((teams) => [...teams, team])));
  }

  rename(teamId: number, name: string): Observable<Team> {
    return this.http.patch<Team>(`/api/v1/teams/${teamId}`, { name }).pipe(tap((team) => this.replace(team)));
  }

  /** Sustituye la lista de médicos del equipo. */
  setDoctors(teamId: number, doctors: Doctor[]): Observable<Team> {
    return this.http
      .put<Team>(`/api/v1/teams/${teamId}/doctors`, { doctors })
      .pipe(tap((team) => this.replace(team)));
  }

  /** Borra el equipo con todos sus cuadrantes. */
  delete(teamId: number): Observable<void> {
    return this.http
      .delete<void>(`/api/v1/teams/${teamId}`)
      .pipe(tap(() => this.teams.update((teams) => teams.filter((team) => team.id !== teamId))));
  }

  select(teamId: number): void {
    this.selectedTeamId.set(teamId);
    try {
      localStorage.setItem(SELECTED_TEAM_KEY, String(teamId));
    } catch {
      // Sin almacenamiento del navegador simplemente no se recuerda el equipo.
    }
  }

  /** Equipo con el que abrir la aplicación: el último seleccionado si sigue existiendo, o el primero. */
  initialTeamId(): number | null {
    let remembered: number | null = null;
    try {
      remembered = Number(localStorage.getItem(SELECTED_TEAM_KEY)) || null;
    } catch {
      remembered = null;
    }
    const teams = this.teams();
    return teams.find((team) => team.id === remembered)?.id ?? teams[0]?.id ?? null;
  }

  private replace(updated: Team): void {
    this.teams.update((teams) => teams.map((team) => (team.id === updated.id ? updated : team)));
  }
}
