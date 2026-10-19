import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { toIsoDate } from '../common/date.utils';
import { HolidayEntity } from '../rota/entities/holiday.entity';
import { DayInfo } from '../scheduling/scheduling.types';

export interface HolidayApiItem {
  date: string;
  localName?: string;
  name?: string;
  global?: boolean;
  counties?: string[] | null;
}

export interface HolidayRecord {
  year: number;
  city: string;
  date: string;
  name: string;
  source?: 'api' | 'manual';
}

export interface HolidayRepositoryPort {
  findCached(year: number, city: string): Promise<HolidayRecord[]>;
  upsertMany(items: HolidayRecord[]): Promise<void>;
}

export const CITY_TO_REGION: Record<string, string> = {
  madrid: 'ES-MD',
  barcelona: 'ES-CT',
  valencia: 'ES-VC',
  alicante: 'ES-VC',
  sevilla: 'ES-AN',
  seville: 'ES-AN',
  malaga: 'ES-AN',
  bilbao: 'ES-PV',
  'san sebastian': 'ES-PV',
  zaragoza: 'ES-AR',
  murcia: 'ES-MC',
  palma: 'ES-IB',
  'las palmas': 'ES-CN',
  'santa cruz de tenerife': 'ES-CN',
  valladolid: 'ES-CL',
  vigo: 'ES-GA',
  'santiago de compostela': 'ES-GA',
  oviedo: 'ES-AS',
  santander: 'ES-CB',
  pamplona: 'ES-NC',
  logrono: 'ES-RI',
  toledo: 'ES-CM',
  caceres: 'ES-EX',
  badajoz: 'ES-EX',
  girona: 'ES-CT',
  tarragona: 'ES-CT',
  castellon: 'ES-VC',
  cordoba: 'ES-AN',
  granada: 'ES-AN',
  cadiz: 'ES-AN',
  huelva: 'ES-AN',
  jaen: 'ES-AN',
  almeria: 'ES-AN',
  ceuta: 'ES-CE',
  melilla: 'ES-ML',
};

function hasHolidayDate(holidays: Set<Date>, target: Date): boolean {
  const targetKey = toIsoDate(target);
  for (const holiday of holidays) {
    if (toIsoDate(holiday) === targetKey) {
      return true;
    }
  }

  return false;
}

function isHolidayForCity(holiday: HolidayApiItem, regionCode?: string): boolean {
  if (holiday.global) {
    return true;
  }

  if (holiday.counties == null) {
    return true;
  }

  return Boolean(regionCode && holiday.counties.includes(regionCode));
}

export function classifyDay(date: Date, holidays: Set<Date>): DayInfo {
  const weekday = date.getUTCDay();
  const publicHoliday = hasHolidayDate(holidays, date);
  if (publicHoliday || weekday === 0) {
    return {
      date,
      dayType: 'holiday',
      publicHoliday,
      durationHours: 23,
      shiftStart: '09:00',
      shiftEnd: '08:00+1',
    };
  }

  if (weekday === 6) {
    return {
      date,
      dayType: 'saturday',
      publicHoliday: false,
      durationHours: 18,
      shiftStart: '15:00',
      shiftEnd: '09:00+1',
    };
  }

  return {
    date,
    dayType: 'weekday',
    publicHoliday: false,
    durationHours: 17,
    shiftStart: '15:00',
    shiftEnd: '08:00+1',
  };
}

export function classifyYear(year: number, holidays: Set<Date>): DayInfo[] {
  const days: DayInfo[] = [];
  const current = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));

  while (current <= end) {
    days.push(classifyDay(new Date(current), holidays));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

export async function fetchHolidays(
  year: number,
  city: string,
  repository: HolidayRepositoryPort,
  fetcher: (year: number) => Promise<HolidayApiItem[]>,
) {
  const rawHolidays = await fetcher(year);
  const regionCode = CITY_TO_REGION[city.toLowerCase()];
  const seenDates = new Set<string>();
  const items: HolidayRecord[] = [];

  for (const holiday of rawHolidays) {
    if (!isHolidayForCity(holiday, regionCode)) {
      continue;
    }

    const holidayDate = holiday.date;
    if (seenDates.has(holidayDate)) {
      continue;
    }
    seenDates.add(holidayDate);

    items.push({
      year,
      city,
      date: holidayDate,
      name: holiday.localName || holiday.name || '',
    });
  }

  await repository.upsertMany(items);
  return items;
}

export async function getHolidays(
  year: number,
  city: string,
  repository: HolidayRepositoryPort,
  fetcher: (year: number) => Promise<HolidayApiItem[]>,
) {
  const cached = await repository.findCached(year, city);
  if (cached.length > 0) {
    return cached;
  }

  return fetchHolidays(year, city, repository, fetcher);
}

@Injectable()
export class HolidaysService {
  constructor(
    @InjectRepository(HolidayEntity)
    private readonly holidaysRepository: Repository<HolidayEntity>,
  ) {}

  async fetchHolidays(year: number, city: string) {
    return fetchHolidays(year, city, this.repositoryPort, (targetYear) =>
      this.fetchHolidayApi(targetYear),
    );
  }

  async getHolidays(year: number, city: string) {
    return getHolidays(year, city, this.repositoryPort, (targetYear) =>
      this.fetchHolidayApi(targetYear),
    );
  }

  async createCustomHoliday(year: number, city: string, date: string, name: string) {
    const existing = await this.holidaysRepository.findOne({
      where: { year, city, date },
    });
    if (existing) {
      throw new Error(`Ya existe un festivo para el ${date}`);
    }

    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    if (dayOfWeek === 0) {
      throw new Error('El domingo siempre es festivo y no se puede marcar manualmente');
    }

    const entity = this.holidaysRepository.create({
      year,
      city,
      date,
      name,
      source: 'manual',
    });
    await this.holidaysRepository.save(entity);
    return this.holidaysRepository.find({
      where: { year, city },
      order: { date: 'ASC' },
    });
  }

  async deleteCustomHoliday(year: number, city: string, date: string) {
    const existing = await this.holidaysRepository.findOne({
      where: { year, city, date },
    });
    if (!existing) {
      throw new Error(`No se ha encontrado ningún festivo para el ${date}`);
    }
    if (existing.source !== 'manual') {
      throw new Error('Solo se pueden eliminar los festivos creados manualmente');
    }

    await this.holidaysRepository.remove(existing);
    return this.holidaysRepository.find({
      where: { year, city },
      order: { date: 'ASC' },
    });
  }

  private readonly repositoryPort: HolidayRepositoryPort = {
    findCached: async (year, city) =>
      this.holidaysRepository.find({
        where: { year, city },
        order: { date: 'ASC' },
      }),
    upsertMany: async (items) => {
      if (items.length === 0) {
        return;
      }

      // Insert único e idempotente: dos peticiones concurrentes con la caché vacía
      // llegan aquí a la vez, y el INSERT IGNORE evita que la segunda viole
      // la constraint única (year, city, date). Al no pisar la fila existente, un
      // festivo 'manual' sobrevive a un refresco desde la API.
      await this.holidaysRepository
        .createQueryBuilder()
        .insert()
        .into(HolidayEntity)
        .values(items.map((item) => ({ ...item, source: 'api' as const })))
        .orIgnore()
        // En MySQL TypeORM relee las filas insertadas por id tras el INSERT; las ignoradas no
        // tienen id y esa relectura falla ("entity id is not set"). No se usan los valores devueltos.
        .updateEntity(false)
        .execute();
    },
  };

  private async fetchHolidayApi(year: number): Promise<HolidayApiItem[]> {
    const baseUrl = process.env.HOLIDAY_API_URL ?? 'https://date.nager.at/api/v3';
    const response = await fetch(`${baseUrl}/PublicHolidays/${year}/ES`);
    if (!response.ok) {
      throw new Error(await response.text());
    }

    return (await response.json()) as HolidayApiItem[];
  }
}
