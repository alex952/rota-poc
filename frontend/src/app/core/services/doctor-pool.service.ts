import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Doctor, RotaType } from '../models/doctor.model';

@Injectable({ providedIn: 'root' })
export class DoctorPoolService {
  private readonly http = inject(HttpClient);

  readonly doctors = signal<Doctor[]>([]);

  /** Último orden barajado de cada grupo; se reaplica si los médicos llegan después. */
  private readonly savedOrder: Partial<Record<RotaType, string[]>> = {};

  readonly acDoctors = computed(() =>
    this.doctors().filter((d) => d.rota_type === 'AC')
  );

  readonly apDoctors = computed(() =>
    this.doctors().filter((d) => d.rota_type === 'AP')
  );

  loadDoctors(): void {
    this.http.get<Doctor[]>('assets/doctors.json').subscribe({
      next: (docs) => {
        this.doctors.set(docs);
        for (const rotaType of Object.keys(this.savedOrder) as RotaType[]) {
          this.sortGroup(rotaType, this.savedOrder[rotaType] ?? []);
        }
      },
      error: (err) => console.error('Failed to load doctors.json', err),
    });
  }

  addDoctor(doctor: Doctor): void {
    this.doctors.update((current) => [...current, doctor]);
  }

  /**
   * Reordena los médicos del grupo según `orderedIds` (el orden barajado con que se generó
   * el cuadrante). Los que no aparecen en la lista conservan su orden y van al final.
   */
  applyOrder(rotaType: RotaType, orderedIds: string[]): void {
    this.savedOrder[rotaType] = orderedIds;
    this.sortGroup(rotaType, orderedIds);
  }

  private sortGroup(rotaType: RotaType, orderedIds: string[]): void {
    const position = new Map(orderedIds.map((id, index) => [id, index]));
    this.doctors.update((current) => {
      const sorted = current
        .filter((d) => d.rota_type === rotaType)
        .sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity));
      // Cada médico del grupo ocupa el hueco que dejó otro del mismo grupo en la lista global.
      let next = 0;
      return current.map((d) => (d.rota_type === rotaType ? sorted[next++] : d));
    });
  }

  getDoctorsByType(rotaType: RotaType): Doctor[] {
    return this.doctors().filter((d) => d.rota_type === rotaType);
  }
}
