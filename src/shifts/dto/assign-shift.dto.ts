import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignShiftDto {
  @IsNotEmpty()
  @IsUUID()
  teacherId: string;

  @IsNotEmpty()
  @IsUUID()
  shiftId: string;

  @IsOptional()
  @IsString()
  semester?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
