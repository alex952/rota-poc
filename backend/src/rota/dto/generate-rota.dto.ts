import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DoctorInputDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  department!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  hours_reduced_per_day?: number;
}

export class GenerateRotaDto {
  @IsInt()
  year!: number;

  @IsIn(['AC', 'AP'])
  rota_type!: 'AC' | 'AP';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DoctorInputDto)
  pool!: DoctorInputDto[];
}
