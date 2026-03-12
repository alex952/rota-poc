import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

export interface ConfigResponse {
  city: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly http = inject(HttpClient);
  private config$: Observable<ConfigResponse> | null = null;

  getConfig(): Observable<ConfigResponse> {
    if (!this.config$) {
      this.config$ = this.http
        .get<ConfigResponse>('/api/v1/config')
        .pipe(shareReplay(1));
    }
    return this.config$;
  }
}
