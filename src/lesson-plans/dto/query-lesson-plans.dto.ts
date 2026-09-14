import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryLessonPlansDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsIn(['all', 'pending', 'reviewed', 'needs_revision'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
