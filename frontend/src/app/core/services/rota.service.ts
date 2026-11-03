import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AddDoctorRequest, GenerateRequest, AssignmentStrategy, DEFAULT_STRATEGY, ReplaceRequest, RotaResponse } from '../models/rota.model';
import { Doctor, RotaType } from '../models/doctor.model';

@Injectable({ providedIn: 'root' })
export class RotaService {
  private readonly http = inject(HttpClient);

  getRota(year: number, rotaType: RotaType): Observable<RotaResponse> {
    return this.http.get<RotaResponse>(`/api/v1/rota/${year}/${rotaType}`);
  }

  getRotas(year: number): Observable<RotaResponse[]> {
    return this.http.get<RotaResponse[]>(`/api/v1/rota/${year}`);
  }

  exportRotas(year: number): Observable<Blob> {
    return this.http.get(`/api/v1/rota/${year}/export`, { responseType: 'blob' });
  }

  /** Genera de una vez los cuadrantes AC y AP del año; devuelve [AC, AP]. */
  generateRotas(year: number, acPool: Doctor[], apPool: Doctor[],
    strategy: AssignmentStrategy = DEFAULT_STRATEGY,
  ): Observable<RotaResponse[]> {
    const toInput = (doctor: Doctor) => ({
      id: doctor.id,
      name: doctor.name,
      department: doctor.department,
    });
    const request: GenerateRequest = {
      year,
      ac_pool: acPool.map(toInput),
      ap_pool: apPool.map(toInput),
      strategy,
    };
    return this.http.post<RotaResponse[]>('/api/v1/rota/generate', request);
  }

  /** Borra los cuadrantes AC y AP del año; los festivos se conservan. */
  deleteRotas(year: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/rota/${year}`);
  }

  addDoctor(year: number, rotaType: RotaType, request: AddDoctorRequest): Observable<RotaResponse> {
    return this.http.post<RotaResponse>(`/api/v1/rota/${year}/${rotaType}/add`, request);
  }

  replaceDoctor(year: number, rotaType: RotaType, request: ReplaceRequest): Observable<RotaResponse> {
    return this.http.patch<RotaResponse>(`/api/v1/rota/${year}/${rotaType}/replace`, request);
  }

  getRotaByDoctor(year: number, rotaType: RotaType, doctorId: string): Observable<RotaResponse> {
    return this.http.get<RotaResponse>(`/api/v1/rota/${year}/${rotaType}`, {
      params: { doctor_id: doctorId },
    });
  }
}
