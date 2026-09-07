import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import type { ClassStatus } from '../entities/class.entity';

export class UpdateClassDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  gradeLevel?: string;

  @IsString()
  @IsOptional()
  academicYear?: string;

  @IsIn(['active', 'archived'])
  @IsOptional()
  status?: ClassStatus;

  @IsUUID()
  @IsOptional()
  schoolId?: string | null;

  @IsUUID()
  @IsOptional()
  teacherId?: string | null;
}
