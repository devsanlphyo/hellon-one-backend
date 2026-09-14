import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateLeaveStatusDto {
  @IsNotEmpty({ message: 'Status is required' })
  @IsIn(['approved', 'rejected'], {
    message: 'Status must be either approved or rejected',
  })
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
