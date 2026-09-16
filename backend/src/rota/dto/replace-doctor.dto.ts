import { IsDateString, IsString } from 'class-validator';

export class ReplaceDoctorDto {
  @IsDateString({}, { message: 'la fecha debe ser una fecha válida con formato AAAA-MM-DD' })
  date!: string;

  @IsString({ message: 'el identificador del médico saliente debe ser una cadena de texto' })
  old_doctor_id!: string;

  @IsString({ message: 'el identificador del médico entrante debe ser una cadena de texto' })
  new_doctor_id!: string;
}
