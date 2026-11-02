import {
  CITY,
  HOLIDAY_API_RESPONSE,
  HOLIDAY_API_RESPONSE_WITH_REGIONS,
} from '../helpers/fixtures';

import { classifyDay, classifyYear, fetchHolidays, getHolidays } from '../../src/holidays/holidays.service';

describe('Holiday service', () => {
  it('classifies holidays, Saturdays, Sundays, and weekdays correctly', () => {
    const saturdayHoliday = new Date('2026-01-03');
    const sunday = new Date('2026-01-04');
    const weekday = new Date('2026-01-05');

    expect(classifyDay(saturdayHoliday, new Set([saturdayHoliday]))).toMatchObject({
      dayType: 'holiday',
      durationHours: 23,
      shiftStart: '09:00',
      shiftEnd: '08:00+1',
    });
    expect(classifyDay(sunday, new Set())).toMatchObject({
      dayType: 'holiday',
      durationHours: 23,
    });
    expect(classifyDay(weekday, new Set())).toMatchObject({
      dayType: 'weekday',
      durationHours: 17,
      shiftStart: '15:00',
      shiftEnd: '08:00+1',
    });
  });

  it('trata los festivos especiales de sanidad como festivos aunque no estén en el calendario', () => {
    for (const iso of ['2026-01-01', '2026-01-06', '2026-12-24', '2026-12-25', '2026-12-31']) {
      expect(classifyDay(new Date(iso), new Set())).toMatchObject({
        dayType: 'holiday',
        publicHoliday: true,
        specialHoliday: true,
        durationHours: 23,
        shiftStart: '09:00',
      });
    }
    expect(classifyDay(new Date('2026-12-26'), new Set()).specialHoliday).toBeFalsy();
  });

  it('classifies an entire year into 365 days', () => {
    const days = classifyYear(2026, new Set([new Date('2026-01-01'), new Date('2026-01-06')]));

    expect(days).toHaveLength(365);
    expect(days[0]).toMatchObject({ dayType: 'holiday', durationHours: 23 });
    expect(days[1]).toMatchObject({ dayType: 'weekday', durationHours: 17 });
    expect(days[2]).toMatchObject({ dayType: 'saturday', durationHours: 18 });
  });

  it('keeps national and city-region holidays only', async () => {
    const mockDb = createHolidayDbMock();
    const fetcher = jest.fn().mockResolvedValue(HOLIDAY_API_RESPONSE_WITH_REGIONS);

    const holidays = await fetchHolidays(2026, CITY, mockDb.repository, fetcher);
    expect(holidays.map((holiday) => holiday.name)).toEqual(
      expect.arrayContaining(['Ano Nuevo', 'Dia de la Comunidad de Madrid']),
    );
    expect(holidays.map((holiday) => holiday.name)).not.toEqual(expect.arrayContaining(['San Jose', 'Sant Jordi']));
  });

  it('añade siempre los festivos especiales de sanidad y marca los que ya trae la API', async () => {
    const mockDb = createHolidayDbMock();
    const fetcher = jest.fn().mockResolvedValue(HOLIDAY_API_RESPONSE);

    const holidays = await fetchHolidays(2026, CITY, mockDb.repository, fetcher);
    const specials = holidays.filter((holiday) => holiday.special).map((holiday) => holiday.date);

    expect(specials).toEqual(['2026-01-01', '2026-01-06', '2026-12-24', '2026-12-25', '2026-12-31']);
    expect(holidays.find((holiday) => holiday.date === '2026-12-24')?.name).toBe('Nochebuena');
    expect(holidays.find((holiday) => holiday.date === '2026-12-25')?.name).toBe('Navidad');
    expect(holidays.find((holiday) => holiday.date === '2026-05-01')?.special).toBe(false);
    expect(holidays.map((holiday) => holiday.date)).toEqual([...holidays.map((h) => h.date)].sort());
  });

  it('completa una caché anterior sin festivos especiales', async () => {
    const mockDb = createHolidayDbMock();
    await mockDb.repository.upsertMany([
      { year: 2026, city: CITY, date: '2026-01-01', name: 'Ano Nuevo' },
      { year: 2026, city: CITY, date: '2026-05-01', name: 'Dia del Trabajador' },
    ]);
    const fetcher = jest.fn();

    const holidays = await getHolidays(2026, CITY, mockDb.repository, fetcher);

    expect(fetcher).not.toHaveBeenCalled();
    expect(holidays.filter((holiday: { special?: boolean }) => holiday.special).map((h: { date: string }) => h.date).sort()).toEqual([
      '2026-01-01', '2026-01-06', '2026-12-24', '2026-12-25', '2026-12-31',
    ]);
    expect(holidays.find((holiday: { date: string }) => holiday.date === '2026-01-01')?.name).toBe('Ano Nuevo');
  });

  it('reads cached holidays before hitting the external API again', async () => {
    const mockDb = createHolidayDbMock();
    const fetcher = jest.fn().mockResolvedValue(HOLIDAY_API_RESPONSE);

    const first = await getHolidays(2026, CITY, mockDb.repository, fetcher);
    const second = await getHolidays(2026, CITY, mockDb.repository, fetcher);

    expect(first).toHaveLength(second.length);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('surfaces holiday API failures so controllers can map them to 502', async () => {
    const mockDb = createHolidayDbMock();
    const fetcher = jest.fn().mockRejectedValue(new Error('Server Error'));

    await expect(fetchHolidays(2026, CITY, mockDb.repository, fetcher)).rejects.toThrow('Server Error');
  });

  describe('createCustomHoliday', () => {
    it('creates a manual holiday and returns updated holiday list', async () => {
      const { HolidaysService } = await import('../../src/holidays/holidays.service');
      const mockRepo = createHolidayRepositoryMock();
      const service = new HolidaysService(mockRepo as any);

      const result = await service.createCustomHoliday(2026, CITY, '2026-03-16', 'Festivo Manual');

      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ date: '2026-03-16', name: 'Festivo Manual', source: 'manual' }),
      ]));
    });

    it('rejects creating a holiday that already exists', async () => {
      const { HolidaysService } = await import('../../src/holidays/holidays.service');
      const mockRepo = createHolidayRepositoryMock([{ year: 2026, city: CITY, date: '2026-03-15', name: 'Existing', source: 'api' }]);
      const service = new HolidaysService(mockRepo as any);

      await expect(service.createCustomHoliday(2026, CITY, '2026-03-15', 'Festivo Manual')).rejects.toThrow('Ya existe');
    });

    it('rejects creating a manual holiday on Sunday', async () => {
      const { HolidaysService } = await import('../../src/holidays/holidays.service');
      const mockRepo = createHolidayRepositoryMock();
      const service = new HolidaysService(mockRepo as any);

      await expect(service.createCustomHoliday(2026, CITY, '2026-03-15', 'Festivo Manual')).rejects.toThrow('domingo');
    });
  });

  describe('deleteCustomHoliday', () => {
    it('deletes a manual holiday and returns updated holiday list', async () => {
      const { HolidaysService } = await import('../../src/holidays/holidays.service');
      const mockRepo = createHolidayRepositoryMock([
        { year: 2026, city: CITY, date: '2026-03-15', name: 'Festivo Manual', source: 'manual' },
      ]);
      const service = new HolidaysService(mockRepo as any);

      const result = await service.deleteCustomHoliday(2026, CITY, '2026-03-15');

      expect(result).toHaveLength(0);
      expect(mockRepo.remove).toHaveBeenCalled();
    });

    it('rejects deleting a non-existent holiday', async () => {
      const { HolidaysService } = await import('../../src/holidays/holidays.service');
      const mockRepo = createHolidayRepositoryMock();
      const service = new HolidaysService(mockRepo as any);

      await expect(service.deleteCustomHoliday(2026, CITY, '2026-03-15')).rejects.toThrow('No se ha encontrado');
    });

    it('rechaza eliminar un festivo especial de sanidad aunque se marcara a mano', async () => {
      const { HolidaysService } = await import('../../src/holidays/holidays.service');
      const mockRepo = createHolidayRepositoryMock([
        { year: 2026, city: CITY, date: '2026-12-24', name: 'Nochebuena', source: 'manual', special: true },
      ]);
      const service = new HolidaysService(mockRepo as any);

      await expect(service.deleteCustomHoliday(2026, CITY, '2026-12-24')).rejects.toThrow(
        'Los festivos especiales de sanidad no se pueden eliminar',
      );
    });

    it('rejects deleting an API holiday', async () => {
      const { HolidaysService } = await import('../../src/holidays/holidays.service');
      const mockRepo = createHolidayRepositoryMock([
        { year: 2026, city: CITY, date: '2026-01-01', name: 'Ano Nuevo', source: 'api' },
      ]);
      const service = new HolidaysService(mockRepo as any);

      await expect(service.deleteCustomHoliday(2026, CITY, '2026-01-01')).rejects.toThrow('Solo se pueden eliminar');
    });
  });
});

function createHolidayDbMock() {
  const records: Array<{ year: number; city: string; date: string; name: string; special?: boolean }> = [];

  return {
    repository: {
      findCached: jest.fn(async (year: number, city: string) =>
        records.filter((record) => record.year === year && record.city === city),
      ),
      upsertMany: jest.fn(async (items: Array<{ year: number; city: string; date: string; name: string; special?: boolean }>) => {
        for (const item of items) {
          const existingIndex = records.findIndex(
            (record) => record.year === item.year && record.city === item.city && record.date === item.date,
          );
          if (existingIndex >= 0) {
            records[existingIndex] = item;
            continue;
          }
          records.push(item);
        }
      }),
    },
  };
}

function createHolidayRepositoryMock(initialRecords: Array<any> = []) {
  const records = [...initialRecords];
  return {
    find: jest.fn(async (opts: any) => {
      const year = opts.where?.year;
      const city = opts.where?.city;
      return records.filter((r) => r.year === year && r.city === city);
    }),
    findOne: jest.fn(async (opts: any) => {
      const year = opts.where?.year;
      const city = opts.where?.city;
      const date = opts.where?.date;
      return records.find((r) => r.year === year && r.city === city && r.date === date) || null;
    }),
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (entity: any) => {
      records.push(entity);
      return entity;
    }),
    remove: jest.fn(async (entity: any) => {
      const index = records.findIndex((r) => r.year === entity.year && r.city === entity.city && r.date === entity.date);
      if (index >= 0) records.splice(index, 1);
      return entity;
    }),
  };
}

