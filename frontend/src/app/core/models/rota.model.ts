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
  atencion_continuada: DoctorRef;
  atencion_primaria: DoctorRef;
}

export interface DoctorStats {
  doctor_id: string;
  doctor_name: string;
  total_hours: number;
  ac_hours: number;
  ap_hours: number;
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
  generated_at: string;
  schedule: DayAssignment[];
  stats: StatsResponse;
  warnings: string[];
}

export interface GenerateRequest {
  year: number;
  pool: { id: string; name: string; department: string }[];
}

export interface ReplaceRequest {
  date: string;
  service_type: 'atencion_continuada' | 'atencion_primaria';
  old_doctor_id: string;
  new_doctor_id: string;
}
