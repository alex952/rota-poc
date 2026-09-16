import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'la fecha debe tener el formato AAAA-MM-DD',
  })
  readonly date!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  readonly name!: string;
}
