import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GenerateRequest, ReplaceRequest, RotaResponse } from '../models/rota.model';
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

  generateRota(year: number, rotaType: RotaType, pool: Doctor[]): Observable<RotaResponse> {
    const request: GenerateRequest = {
      year,
      rota_type: rotaType,
      pool: pool.map((doctor) => ({
        id: doctor.id,
        name: doctor.name,
        department: doctor.department,
      })),
    };
    return this.http.post<RotaResponse>('/api/v1/rota/generate', request);
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
