import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Doctor, RotaType } from '../models/doctor.model';

@Injectable({ providedIn: 'root' })
export class DoctorPoolService {
  private readonly http = inject(HttpClient);

  readonly doctors = signal<Doctor[]>([]);

  readonly acDoctors = computed(() =>
    this.doctors().filter((d) => d.rota_type === 'AC')
  );

  readonly apDoctors = computed(() =>
    this.doctors().filter((d) => d.rota_type === 'AP')
  );

  loadDoctors(): void {
    this.http.get<Doctor[]>('assets/doctors.json').subscribe({
      next: (docs) => this.doctors.set(
        docs.map((doctor) => ({
          ...doctor,
          hours_reduced_per_day: doctor.hours_reduced_per_day ?? 0,
        }))
      ),
      error: (err) => console.error('Failed to load doctors.json', err),
    });
  }

  addDoctor(doctor: Doctor): void {
    this.doctors.update((current) => [...current, doctor]);
  }

  getDoctorsByType(rotaType: RotaType): Doctor[] {
    return this.doctors().filter((d) => d.rota_type === rotaType);
  }
}
