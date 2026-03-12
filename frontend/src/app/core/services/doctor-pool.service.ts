import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Doctor } from '../models/doctor.model';

@Injectable({ providedIn: 'root' })
export class DoctorPoolService {
  private readonly http = inject(HttpClient);

  readonly doctors = signal<Doctor[]>([]);

  loadDoctors(): void {
    this.http.get<Doctor[]>('assets/doctors.json').subscribe({
      next: (docs) => this.doctors.set(docs),
      error: (err) => console.error('Failed to load doctors.json', err),
    });
  }

  addDoctor(doctor: Doctor): void {
    this.doctors.update((current) => [...current, doctor]);
  }
}
