import { IsArray, IsInt, IsNotEmpty, IsUUID, Max, Min } from 'class-validator';

export class SaveStaffScheduleDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek: number[]; // e.g. [1, 2, 3, 4, 5]
}
