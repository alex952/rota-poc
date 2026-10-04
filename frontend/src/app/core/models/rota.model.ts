import { RotaType } from './doctor.model';

export interface DoctorRef {
  doctor_id: string;
  doctor_name: string;
}

export interface DayAssignment {
  date: string;
  day_type: 'weekday' | 'saturday' | 'holiday';
  shift_start: string;
  shift_end: string;
  duration_hours: number;
  doctors: DoctorRef[];
}

export interface DoctorStats {
  doctor_id: string;
  doctor_name: string;
  total_hours: number;
  target_hours?: number;
  hours_vs_target?: number;
  monthly_hours: Record<number, number>;
  shifts_weekday: number;
  shifts_saturday: number;
  shifts_sunday_holiday: number;
}

export interface StatsResponse {
  doctors: DoctorStats[];
}

export interface RotaResponse {
  year: number;
  city: string;
  rota_type: RotaType;
  doctors_per_day: number;
  generated_at: string;
  schedule: DayAssignment[];
  stats: StatsResponse;
  warnings: string[];
}

export interface GenerateRequest {
  year: number;
  rota_type: RotaType;
  pool: { id: string; name: string; department: string }[];
}

export interface ReplaceRequest {
  date: string;
  old_doctor_id: string;
  new_doctor_id: string;
}

export interface AddDoctorRequest {
  date: string;
  doctor_id: string;
}

/** Merged day for the combined calendar view */
export interface MergedDayAssignment {
  date: string;
  day_type: 'weekday' | 'saturday' | 'holiday';
  shift_start: string;
  shift_end: string;
  duration_hours: number;
  acDoctors: DoctorRef[];
  apDoctors: DoctorRef[];
}
