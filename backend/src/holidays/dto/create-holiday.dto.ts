import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  readonly date!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  readonly name!: string;
}
