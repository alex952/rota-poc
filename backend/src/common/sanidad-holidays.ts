/**
 * Festivos especiales de sanidad: se añaden siempre al calendario de festivos de cada
 * año, sean o no festivos oficiales, y se marcan como especiales. Cuentan como festivo
 * a todos los efectos (horario y duración) y llevan siempre dos refuerzos.
 */
export const SANIDAD_SPECIAL_HOLIDAYS: ReadonlyArray<{ monthDay: string; name: string }> = [
  { monthDay: '01-01', name: 'Año Nuevo' },
  { monthDay: '01-06', name: 'Reyes' },
  { monthDay: '12-24', name: 'Nochebuena' },
  { monthDay: '12-25', name: 'Navidad' },
  { monthDay: '12-31', name: 'Nochevieja' },
];

const SPECIAL_MONTH_DAYS = new Set(SANIDAD_SPECIAL_HOLIDAYS.map((holiday) => holiday.monthDay));

/** `isoDate` en formato AAAA-MM-DD. */
export function isSanidadSpecialHoliday(isoDate: string): boolean {
  return SPECIAL_MONTH_DAYS.has(isoDate.slice(5, 10));
}

export function sanidadSpecialHolidays(year: number): Array<{ date: string; name: string }> {
  return SANIDAD_SPECIAL_HOLIDAYS.map((holiday) => ({
    date: `${year}-${holiday.monthDay}`,
    name: holiday.name,
  }));
}
