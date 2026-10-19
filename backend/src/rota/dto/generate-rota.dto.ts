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

export class GenerateRotaDto {
  @IsInt({ message: 'el año debe ser un número entero' })
  year!: number;

  @IsIn(['AC', 'AP'], { message: 'el tipo de cuadrante debe ser AC o AP' })
  rota_type!: 'AC' | 'AP';

  @IsArray({ message: 'el grupo de médicos debe ser una lista' })
  @ValidateNested({ each: true, message: 'cada médico del grupo debe ser un objeto válido' })
  @Type(() => DoctorInputDto)
  pool!: DoctorInputDto[];

  // Método de asignación; si se omite, el servicio usa 'balanced'.
  @IsOptional()
  @IsIn(ASSIGNMENT_STRATEGY_IDS, { message: 'el método de asignación debe ser balanced o wheels' })
  strategy?: AssignmentStrategyId;
}
