import { DayAssignment, DoctorInput, DoctorStats } from './scheduling.types';

export function calculateStats(
  schedule: DayAssignment[],
  pool: DoctorInput[],
  targetHours: Record<string, number> = {},
): DoctorStats[] {
  const doctorMap = new Map(pool.map((doctor) => [doctor.id, doctor]));

  const totalHours: Record<string, number> = {};
  const primaryHours: Record<string, number> = {};
  const refuerzoHours: Record<string, number> = {};
  const monthlyHours: Record<string, Record<string, number>> = {};
  const shiftsWeekday: Record<string, number> = {};
  const shiftsSaturday: Record<string, number> = {};
  const shiftsSundayHoliday: Record<string, number> = {};

  for (const doctor of pool) {
    totalHours[doctor.id] = 0;
    primaryHours[doctor.id] = 0;
    refuerzoHours[doctor.id] = 0;
    monthlyHours[doctor.id] = {};
    shiftsWeekday[doctor.id] = 0;
    shiftsSaturday[doctor.id] = 0;
    shiftsSundayHoliday[doctor.id] = 0;
  }

  for (const day of schedule) {
    const month = String(day.date.getUTCMonth() + 1);

    for (const doctor of day.doctors) {
      if (!doctorMap.has(doctor.doctorId)) {
        continue;
      }

      totalHours[doctor.doctorId] += day.durationHours;
      primaryHours[doctor.doctorId] += day.durationHours;
      monthlyHours[doctor.doctorId][month] =
        (monthlyHours[doctor.doctorId][month] ?? 0) + day.durationHours;

      if (day.dayType === 'weekday') {
        shiftsWeekday[doctor.doctorId] += 1;
      } else if (day.dayType === 'saturday') {
        shiftsSaturday[doctor.doctorId] += 1;
      } else {
        shiftsSundayHoliday[doctor.doctorId] += 1;
      }
    }

    for (const refuerzo of day.refuerzos) {
      if (!doctorMap.has(refuerzo.doctorId)) {
        continue;
      }

      totalHours[refuerzo.doctorId] += refuerzo.durationHours;
      refuerzoHours[refuerzo.doctorId] += refuerzo.durationHours;
      monthlyHours[refuerzo.doctorId][month] =
        (monthlyHours[refuerzo.doctorId][month] ?? 0) + refuerzo.durationHours;
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
      primaryHours: primaryHours[doctor.id],
      refuerzoHours: refuerzoHours[doctor.id],
      monthlyHours: monthlyHours[doctor.id],
      shiftsWeekday: shiftsWeekday[doctor.id],
      shiftsSaturday: shiftsSaturday[doctor.id],
      shiftsSundayHoliday: shiftsSundayHoliday[doctor.id],
    };
  });
}
