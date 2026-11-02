import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { HolidayEntity } from '../../src/rota/entities/holiday.entity';
import { HolidaysService } from '../../src/holidays/holidays.service';
import { CITY, HOLIDAY_API_RESPONSE, YEAR_2026 } from '../helpers/fixtures';
import { createTestApp } from '../helpers/test-app';

describe('Holiday upsert idempotency', () => {
  let app: NestFastifyApplication;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let holidaysService: HolidaysService;
  let holidaysRepository: Repository<HolidayEntity>;

  beforeEach(async () => {
    process.env.DB_TYPE = 'sqljs';
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => HOLIDAY_API_RESPONSE,
      text: async () => JSON.stringify(HOLIDAY_API_RESPONSE),
    } as Response);
    app = await createTestApp();
    holidaysService = app.get(HolidaysService);
    holidaysRepository = app.get<Repository<HolidayEntity>>(
      getRepositoryToken(HolidayEntity),
    );
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
    if (app) {
      await app.close();
    }
  });

  it('resolves two concurrent cold-cache reads without violating the unique constraint', async () => {
    await expect(
      Promise.all([
        holidaysService.getHolidays(YEAR_2026, CITY),
        holidaysService.getHolidays(YEAR_2026, CITY),
      ]),
    ).resolves.toBeDefined();

    const stored = await holidaysRepository.find({
      where: { year: YEAR_2026, city: CITY },
      order: { date: 'ASC' },
    });
    // La API simulada no trae el 24 ni el 31 de diciembre: se añaden como festivos especiales.
    expect(stored).toHaveLength(HOLIDAY_API_RESPONSE.length + 2);

    const dates = stored.map((holiday) => holiday.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('keeps a manual holiday untouched when the API refresh returns the same date', async () => {
    const sharedDate = HOLIDAY_API_RESPONSE[0].date;
    await holidaysService.createCustomHoliday(
      YEAR_2026,
      CITY,
      sharedDate,
      'Festivo local del hospital',
    );

    // fetchHolidays fuerza el refresco: getHolidays cortocircuitaría con la caché ya poblada.
    await holidaysService.fetchHolidays(YEAR_2026, CITY);

    const rowsForSharedDate = await holidaysRepository.find({
      where: { year: YEAR_2026, city: CITY, date: sharedDate },
    });
    expect(rowsForSharedDate).toHaveLength(1);
    expect(rowsForSharedDate[0].source).toBe('manual');
    expect(rowsForSharedDate[0].name).toBe('Festivo local del hospital');

    const stored = await holidaysService.getHolidays(YEAR_2026, CITY);
    expect(stored).toHaveLength(HOLIDAY_API_RESPONSE.length + 2);
    expect(stored.find((holiday) => holiday.date === sharedDate)?.source).toBe('manual');
  });
});
