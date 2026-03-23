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
});

function createHolidayDbMock() {
  const records: Array<{ year: number; city: string; date: string; name: string }> = [];

  return {
    repository: {
      findCached: jest.fn(async (year: number, city: string) =>
        records.filter((record) => record.year === year && record.city === city),
      ),
      upsertMany: jest.fn(async (items: Array<{ year: number; city: string; date: string; name: string }>) => {
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

