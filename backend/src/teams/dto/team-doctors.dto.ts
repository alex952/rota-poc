import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import { RotaType } from '../../scheduling/scheduling.types';

export class TeamDoctorDto {
  @IsString({ message: 'el identificador del médico debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'el identificador del médico no puede estar vacío' })
  id!: string;

  @IsString({ message: 'el nombre del médico debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'el nombre del médico no puede estar vacío' })
  name!: string;

  @IsString({ message: 'el departamento del médico debe ser una cadena de texto' })
  department!: string;

  @IsIn(['AC', 'AP'], { message: 'el grupo del médico debe ser AC o AP' })
  rota_type!: RotaType;
}

/** Lista completa de médicos de un equipo: sustituye a la anterior. */
export class TeamDoctorsDto {
  @IsArray({ message: 'la lista de médicos debe ser una lista' })
  @ArrayNotEmpty({ message: 'la lista de médicos no puede estar vacía' })
  @ValidateNested({ each: true, message: 'cada médico de la lista debe ser un objeto válido' })
  @Type(() => TeamDoctorDto)
  doctors!: TeamDoctorDto[];
}
