import type { AssignmentStrategyId } from './strategies/assignment-strategy';

export type RotaType = 'AC' | 'AP';
export type DayType = 'weekday' | 'saturday' | 'holiday';

export interface DoctorInput {
  id: string;
  name: string;
  department: string;
}

export interface DoctorRef {
  doctorId: string;
  doctorName: string;
}

export interface DayInfo {
  date: Date;
  dayType: DayType;
  // true si la fecha figura en el calendario de festivos, sea cual sea el día de la
  // semana. Un domingo normal tiene dayType 'holiday' pero publicHoliday falso.
  // Opcional: los días reconstruidos desde la base de datos no lo conocen (= falso).
  publicHoliday?: boolean;
  durationHours: number;
  shiftStart: string;
  shiftEnd: string;
}

export interface DayAssignment extends DayInfo {
  doctors: DoctorRef[];
}

export interface DoctorStats {
  doctorId: string;
  doctorName: string;
  totalHours: number;
  targetHours: number;
  hoursVsTarget: number;
  monthlyHours: Record<string, number>;
  shiftsWeekday: number;
  shiftsSaturday: number;
  shiftsSundayHoliday: number;
}

export interface StatsResponse {
  doctors: DoctorStats[];
}

export interface RotaSchedule {
  year: number;
  rotaType: RotaType;
  strategy: AssignmentStrategyId;
  doctorsPerDay: number;
  schedule: DayAssignment[];
  stats: StatsResponse;
  warnings: string[];
}
