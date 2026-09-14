import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateShiftDto {
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsString()
  semester?: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  notes?: string;
}
