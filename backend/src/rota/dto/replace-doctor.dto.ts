import { IsDateString, IsString } from 'class-validator';

export class ReplaceDoctorDto {
  @IsDateString()
  date!: string;

  @IsString()
  old_doctor_id!: string;

  @IsString()
  new_doctor_id!: string;
}
