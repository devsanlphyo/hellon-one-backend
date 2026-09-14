import { IsIn, IsOptional, IsString } from 'class-validator';

export class QueryLeavesDto {
  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  search?: string;
}
