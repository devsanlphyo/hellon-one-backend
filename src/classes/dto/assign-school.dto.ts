import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignSchoolDto {
  @IsUUID()
  @IsNotEmpty()
  schoolId: string;
}
