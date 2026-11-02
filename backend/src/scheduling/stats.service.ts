import { DayAssignment, DoctorInput, DoctorStats } from './scheduling.types';

export function calculateStats(
  schedule: DayAssignment[],
  pool: DoctorInput[],
  targetHours: Record<string, number> = {},
): DoctorStats[] {
  const doctorMap = new Map(pool.map((doctor) => [doctor.id, doctor]));

  const totalHours: Record<string, number> = {};
  const monthlyHours: Record<string, Record<string, number>> = {};
  const shiftsWeekday: Record<string, number> = {};
  const shiftsSaturday: Record<string, number> = {};
  const shiftsSundayHoliday: Record<string, number> = {};
  const shiftsRefuerzo: Record<string, number> = {};

  for (const doctor of pool) {
    totalHours[doctor.id] = 0;
    monthlyHours[doctor.id] = {};
    shiftsWeekday[doctor.id] = 0;
    shiftsSaturday[doctor.id] = 0;
    shiftsSundayHoliday[doctor.id] = 0;
    shiftsRefuerzo[doctor.id] = 0;
  }

  for (const day of schedule) {
    const month = String(day.date.getUTCMonth() + 1);

    for (const doctor of day.doctors) {
      if (!doctorMap.has(doctor.doctorId)) {
        continue;
      }

      // El refuerzo de un AC tiene horario AP: su duración va en la propia asignación.
      const hours = doctor.durationHours ?? day.durationHours;
      totalHours[doctor.doctorId] += hours;
      monthlyHours[doctor.doctorId][month] =
        (monthlyHours[doctor.doctorId][month] ?? 0) + hours;
      if (doctor.role === 'refuerzo') {
        shiftsRefuerzo[doctor.doctorId] += 1;
      }

      if (day.dayType === 'weekday') {
        shiftsWeekday[doctor.doctorId] += 1;
      } else if (day.dayType === 'saturday') {
        shiftsSaturday[doctor.doctorId] += 1;
      } else {
        shiftsSundayHoliday[doctor.doctorId] += 1;
      }
    }
  }

  return pool.map((doctor) => {
    const target = targetHours[doctor.id] ?? 0;
    return {
      doctorId: doctor.id,
      doctorName: doctor.name,
      totalHours: totalHours[doctor.id],
      targetHours: target,
      hoursVsTarget: totalHours[doctor.id] - target,
      monthlyHours: monthlyHours[doctor.id],
      shiftsWeekday: shiftsWeekday[doctor.id],
      shiftsSaturday: shiftsSaturday[doctor.id],
      shiftsSundayHoliday: shiftsSundayHoliday[doctor.id],
      shiftsRefuerzo: shiftsRefuerzo[doctor.id],
    };
  });
}
