import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateHolidayDto {
  @IsString({ message: 'la fecha debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'la fecha es obligatoria' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'la fecha debe tener el formato AAAA-MM-DD',
  })
  readonly date!: string;

  @IsString({ message: 'el nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'el nombre es obligatorio' })
  @Length(1, 200, { message: 'el nombre debe tener entre 1 y 200 caracteres' })
  readonly name!: string;
}
