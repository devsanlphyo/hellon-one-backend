import { IsISO8601, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsNotEmpty({ message: 'Start date is required' })
  @IsISO8601({}, { message: 'Start date must be a valid ISO date (YYYY-MM-DD)' })
  startDate: string;

  @IsNotEmpty({ message: 'End date is required' })
  @IsISO8601({}, { message: 'End date must be a valid ISO date (YYYY-MM-DD)' })
  endDate: string;

  @IsNotEmpty({ message: 'Reason is required' })
  @IsString()
  @MinLength(3, { message: 'Reason must be at least 3 characters' })
  reason: string;
}
