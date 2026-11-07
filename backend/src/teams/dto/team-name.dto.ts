import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Nombre de un equipo, para crearlo o renombrarlo. Se recortan los espacios y un nombre
 * ausente cuenta como vacío (valor por defecto ''), para dar un único mensaje.
 */
export class TeamNameDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'el nombre del equipo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'el nombre del equipo no puede estar vacío' })
  @MaxLength(100, { message: 'el nombre del equipo no puede superar los 100 caracteres' })
  name: string = '';
}
