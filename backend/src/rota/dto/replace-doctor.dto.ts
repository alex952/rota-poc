import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

import { RotaType } from '../../scheduling/scheduling.types';

export class ReplaceDoctorDto {
  @IsDateString({}, { message: 'la fecha debe ser una fecha válida con formato AAAA-MM-DD' })
  date!: string;

  @IsString({ message: 'el identificador del médico saliente debe ser una cadena de texto' })
  old_doctor_id!: string;

  @IsString({ message: 'el identificador del médico entrante debe ser una cadena de texto' })
  new_doctor_id!: string;

  /**
   * Grupo del médico saliente. Si es distinto del cuadrante de la ruta, sólo puede ser
   * un refuerzo: sale de su cuadrante y el médico entrante hace el refuerzo en el suyo.
   */
  @IsOptional()
  @IsIn(['AC', 'AP'], { message: 'el grupo del médico saliente debe ser AC o AP' })
  old_rota_type?: RotaType;
}
