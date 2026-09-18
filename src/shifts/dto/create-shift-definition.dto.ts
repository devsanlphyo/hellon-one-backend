import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateShiftDefinitionDto {
  @IsNotEmpty({ message: 'Shift name is required' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Shift code is required' })
  @IsString()
  code: string;

  @IsNotEmpty({ message: 'Start time is required' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in HH:mm format (e.g. 09:00)',
  })
  startTime: string;

  @IsNotEmpty({ message: 'End time is required' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in HH:mm format (e.g. 17:00)',
  })
  endTime: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  graceMinutes?: number;
}
