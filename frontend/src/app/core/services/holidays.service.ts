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
  /** Festivo especial de sanidad (24, 25 y 31 dic, 1 y 6 ene): no se puede desmarcar */
  special?: boolean;
}

export interface HolidaysResponse {
  year: number;
  city: string;
  holidays: HolidayRecord[];
}

@Injectable({ providedIn: 'root' })
export class HolidaysService {
  private readonly http = inject(HttpClient);
  readonly allHolidayDates = signal<ReadonlySet<string>>(new Set<string>());
  readonly manualHolidayDates = signal<ReadonlySet<string>>(new Set<string>());
  readonly specialHolidayDates = signal<ReadonlySet<string>>(new Set<string>());

  getHolidays(year: number): Observable<HolidaysResponse> {
    return this.http.get<HolidaysResponse>(`/api/v1/holidays/${year}`);
  }

  markHoliday(year: number, date: string, name: string): Observable<HolidaysResponse> {
    return this.http.post<HolidaysResponse>(`/api/v1/holidays/${year}`, { date, name }).pipe(
      tap((response) => this.updateHolidayDates(response.holidays)),
    );
  }

  unmarkHoliday(year: number, date: string): Observable<HolidaysResponse> {
    return this.http.delete<HolidaysResponse>(`/api/v1/holidays/${year}/${date}`).pipe(
      tap((response) => this.updateHolidayDates(response.holidays)),
    );
  }

  loadHolidays(year: number): void {
    this.getHolidays(year).subscribe({
      next: (response) => this.updateHolidayDates(response.holidays),
    });
  }

  private updateHolidayDates(holidays: HolidayRecord[]): void {
    const allDates = new Set<string>(holidays.map((h) => h.date));
    const manualDates = new Set<string>(
      holidays.filter((h) => h.source === 'manual').map((h) => h.date),
    );
    this.allHolidayDates.set(allDates);
    this.manualHolidayDates.set(manualDates);
    this.specialHolidayDates.set(
      new Set<string>(holidays.filter((h) => h.special).map((h) => h.date)),
    );
  }
}
