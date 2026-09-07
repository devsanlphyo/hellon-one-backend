import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import type { SchoolStatus } from '../entities/school.entity';

export class UpdateSchoolDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  principalName?: string;

  @IsUUID()
  @IsOptional()
  headmasterId?: string | null;

  @IsIn(['active', 'suspend'])
  @IsOptional()
  status?: SchoolStatus;
}
