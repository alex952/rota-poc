import { DayInfo, DayType, RotaType } from './scheduling.types';

export const AP_WEEKDAY_SATURDAY_HOURS = 7;
export const AP_HOLIDAY_HOURS = 12;

/**
 * Horario AP: lo comparten la guardia AP y todos los refuerzos (también el refuerzo
 * que hace un médico AC). 7h de lunes a sábado y 12h en festivo.
 */
export function apShiftDetails(dayType: DayType): {
  durationHours: number;
  shiftStart: string;
  shiftEnd: string;
} {
  if (dayType === 'holiday') {
    return {
      durationHours: AP_HOLIDAY_HOURS,
      shiftStart: '10:00',
      shiftEnd: '22:00',
    };
  }

  return {
    durationHours: AP_WEEKDAY_SATURDAY_HOURS,
    shiftStart: '15:00',
    shiftEnd: '22:00',
  };
}

export function effectiveDayInfo(rotaType: RotaType, dayInfo: DayInfo): DayInfo {
  if (rotaType !== 'AP') {
    return dayInfo;
  }
  return { ...dayInfo, ...apShiftDetails(dayInfo.dayType) };
}
