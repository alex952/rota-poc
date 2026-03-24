import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class ReplaceDoctorDto {
  @IsDateString()
  date!: string;

  @IsString()
  old_doctor_id!: string;

  @IsString()
  new_doctor_id!: string;

  @IsOptional()
  @IsIn(['primary', 'refuerzo'])
  assignment_kind?: 'primary' | 'refuerzo';

  @IsOptional()
  @IsString()
  linked_primary_doctor_id?: string;
}
