import { IsDateString, IsString } from 'class-validator';

export class AddDoctorDto {
  @IsDateString({}, { message: 'la fecha debe ser una fecha válida con formato AAAA-MM-DD' })
  date!: string;

  @IsString({ message: 'el identificador del médico debe ser una cadena de texto' })
  doctor_id!: string;
}
