import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class SetCalendarDayDto {
  @IsNotEmpty({ message: 'Date is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must be formatted as YYYY-MM-DD',
  })
  date: string;

  @IsNotEmpty({ message: 'isSchoolDay status is required' })
  @IsBoolean()
  isSchoolDay: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}
