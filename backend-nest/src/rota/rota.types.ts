export enum RotaType {
  AC = 'AC',
  AP = 'AP',
}

export enum AssignmentKind {
  Primary = 'primary',
  Refuerzo = 'refuerzo',
}

export type DayType = 'weekday' | 'saturday' | 'holiday';

export interface DoctorIn {
  id: string;
  name: string;
  department: string;
  hours_reduced_per_day: number;
}

export interface DoctorRef {
  doctor_id: string;
  doctor_name: string;
}

export interface RefuerzoAssignment {
  doctor_id: string;
  doctor_name: string;
  linked_primary_doctor_id: string;
  linked_primary_doctor_name: string;
  shift_start: string;
  shift_end: string;
  duration_hours: number;
}

export interface DayInfo {
  date: string;
  day_type: DayType;
  duration_hours: number;
  shift_start: string;
  shift_end: string;
}

export interface DayAssignment {
  date: string;
  day_type: DayType;
  shift_start: string;
  shift_end: string;
  duration_hours: number;
  doctors: DoctorRef[];
  refuerzos: RefuerzoAssignment[];
}

export interface DoctorStats {
  doctor_id: string;
  doctor_name: string;
  total_hours: number;
  target_hours: number;
  hours_vs_target: number;
  primary_hours: number;
  refuerzo_hours: number;
  monthly_hours: Record<string, number>;
  shifts_weekday: number;
  shifts_saturday: number;
  shifts_sunday_holiday: number;
}

export interface StatsResponse {
  doctors: DoctorStats[];
}

export interface RotaSchedule {
  year: number;
  rota_type: RotaType;
  doctors_per_day: number;
  schedule: DayAssignment[];
  stats: StatsResponse;
  warnings: string[];
}

export interface RotaResponse {
  year: number;
  city: string;
  rota_type: RotaType;
  doctors_per_day: number;
  generated_at: Date;
  schedule: DayAssignment[];
  stats: StatsResponse;
  warnings: string[];
}

export interface HolidayItem {
  date: string;
  name: string;
}

export interface HolidaysResponse {
  year: number;
  city: string;
  holidays: HolidayItem[];
}
