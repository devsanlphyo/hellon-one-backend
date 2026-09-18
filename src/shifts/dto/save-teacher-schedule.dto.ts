import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TeacherDayScheduleItemDto {
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number; // 1 = Mon .. 7 = Sun

  @IsOptional()
  @IsUUID()
  shiftId?: string | null;
}

export class SaveTeacherScheduleDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherDayScheduleItemDto)
  schedules: TeacherDayScheduleItemDto[];
}
