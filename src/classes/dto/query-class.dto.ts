import { IsOptional, IsString } from 'class-validator';

export class QueryClassDto {
  @IsString()
  @IsOptional()
  schoolId?: string;

  @IsString()
  @IsOptional()
  gradeLevel?: string;

  @IsString()
  @IsOptional()
  academicYear?: string;
}
