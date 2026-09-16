import { IsArray, IsIn, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DoctorInputDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  department!: string;
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
