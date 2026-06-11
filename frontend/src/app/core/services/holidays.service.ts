import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface HolidayRecord {
  id: number;
  year: number;
  city: string;
  date: string;
  name: string;
  source: 'api' | 'manual';
}

export interface HolidaysResponse {
  year: number;
  city: string;
  holidays: HolidayRecord[];
}

@Injectable({ providedIn: 'root' })
export class HolidaysService {
  private readonly http = inject(HttpClient);
  readonly manualHolidayDates = signal<ReadonlySet<string>>(new Set<string>());

  getHolidays(year: number): Observable<HolidaysResponse> {
    return this.http.get<HolidaysResponse>(`/api/v1/holidays/${year}`);
  }

  markHoliday(year: number, date: string, name: string): Observable<HolidaysResponse> {
    return this.http.post<HolidaysResponse>(`/api/v1/holidays/${year}`, { date, name }).pipe(
      tap((response) => this.updateManualDates(response.holidays)),
    );
  }

  unmarkHoliday(year: number, date: string): Observable<HolidaysResponse> {
    return this.http.delete<HolidaysResponse>(`/api/v1/holidays/${year}/${date}`).pipe(
      tap((response) => this.updateManualDates(response.holidays)),
    );
  }

  loadManualHolidays(year: number): void {
    this.getHolidays(year).subscribe({
      next: (response) => this.updateManualDates(response.holidays),
    });
  }

  private updateManualDates(holidays: HolidayRecord[]): void {
    const manualDates = new Set<string>(
      holidays.filter((h) => h.source === 'manual').map((h) => h.date),
    );
    this.manualHolidayDates.set(manualDates);
  }
}
