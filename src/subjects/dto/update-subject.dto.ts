import { IsIn, IsOptional, IsString } from 'class-validator';
import type { SubjectStatus } from '../entities/subject.entity';

export class UpdateSubjectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsIn(['active', 'archived'])
  @IsOptional()
  status?: SubjectStatus;
}
