export type RotaType = 'AC' | 'AP';
export type DayType = 'weekday' | 'saturday' | 'holiday';

export interface DoctorInput {
  id: string;
  name: string;
  department: string;
  hours_reduced_per_day?: number;
}

export interface DoctorRef {
  doctorId: string;
  doctorName: string;
}

export interface RefuerzoAssignment {
  doctorId: string;
  doctorName: string;
  linkedPrimaryDoctorId: string;
  linkedPrimaryDoctorName: string;
  shiftStart: string;
  shiftEnd: string;
  durationHours: number;
}

export interface DayInfo {
  date: Date;
  dayType: DayType;
  durationHours: number;
  shiftStart: string;
  shiftEnd: string;
}

export interface DayAssignment extends DayInfo {
  doctors: DoctorRef[];
  refuerzos: RefuerzoAssignment[];
}

export interface DoctorStats {
  doctorId: string;
  doctorName: string;
  totalHours: number;
  targetHours: number;
  hoursVsTarget: number;
  primaryHours: number;
  refuerzoHours: number;
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
  doctorsPerDay: number;
  schedule: DayAssignment[];
  stats: StatsResponse;
  warnings: string[];
}
