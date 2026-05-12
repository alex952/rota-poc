export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(value: string, days: number): string {
  const date = fromIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function getIsoMonth(value: string): number {
  return fromIsoDate(value).getUTCMonth() + 1;
}

export function getIsoWeekday(value: string): number {
  const day = fromIsoDate(value).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

export function compareIsoDates(left: string, right: string): number {
  return left.localeCompare(right);
}

export function stripNextDaySuffix(value: string): string {
  return value.replace(/\+1$/, '');
}

export function formatClockTime(value: string): string {
  return stripNextDaySuffix(value).slice(0, 5);
}

export function formatOvernightShiftEnd(value: string): string {
  return `${formatClockTime(value)}+1`;
}

export function formatShiftEnd(start: string, end: string): string {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (endMinutes <= startMinutes) {
    return formatOvernightShiftEnd(end);
  }
  return formatClockTime(end);
}

function toMinutes(value: string): number {
  const [hours, minutes] = stripNextDaySuffix(value).slice(0, 5).split(':');
  return Number(hours) * 60 + Number(minutes);
}
