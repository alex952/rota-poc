import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GenerateRequest, ReplaceRequest, RotaResponse } from '../models/rota.model';
import { Doctor } from '../models/doctor.model';

@Injectable({ providedIn: 'root' })
export class RotaService {
  private readonly http = inject(HttpClient);

  getRota(year: number): Observable<RotaResponse> {
    return this.http.get<RotaResponse>(`/api/v1/rota/${year}`);
  }

  generateRota(year: number, pool: Doctor[]): Observable<RotaResponse> {
    const request: GenerateRequest = { year, pool };
    return this.http.post<RotaResponse>('/api/v1/rota/generate', request);
  }

  replaceDoctor(year: number, request: ReplaceRequest): Observable<RotaResponse> {
    return this.http.patch<RotaResponse>(`/api/v1/rota/${year}/replace`, request);
  }

  getRotaByDoctor(year: number, doctorId: string): Observable<RotaResponse> {
    return this.http.get<RotaResponse>(`/api/v1/rota/${year}`, {
      params: { doctor_id: doctorId },
    });
  }
}
