import { IsArray, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import {
  ASSIGNMENT_STRATEGY_IDS,
  AssignmentStrategyId,
} from '../../scheduling/strategies/assignment-strategy';

export class DoctorInputDto {
  @IsString({ message: 'el identificador del médico debe ser una cadena de texto' })
  id!: string;

  @IsString({ message: 'el nombre del médico debe ser una cadena de texto' })
  name!: string;

  @IsString({ message: 'el departamento del médico debe ser una cadena de texto' })
  department!: string;
}

/** Genera de una vez los cuadrantes AC y AP del año. */
export class GenerateRotaDto {
  @IsInt({ message: 'el año debe ser un número entero' })
  year!: number;

  @IsArray({ message: 'el grupo de médicos AC debe ser una lista' })
  @ValidateNested({ each: true, message: 'cada médico del grupo AC debe ser un objeto válido' })
  @Type(() => DoctorInputDto)
  ac_pool!: DoctorInputDto[];

  @IsArray({ message: 'el grupo de médicos AP debe ser una lista' })
  @ValidateNested({ each: true, message: 'cada médico del grupo AP debe ser un objeto válido' })
  @Type(() => DoctorInputDto)
  ap_pool!: DoctorInputDto[];

  // Equipo del que son los cuadrantes; si se omite, el equipo principal.
  @IsOptional()
  @IsInt({ message: 'el equipo debe ser un número entero' })
  team_id?: number;

  // Método de asignación; si se omite, el servicio usa 'single-wheel'.
  @IsOptional()
  @IsIn(ASSIGNMENT_STRATEGY_IDS, { message: 'el método de asignación debe ser single-wheel o wheels' })
  strategy?: AssignmentStrategyId;
}
