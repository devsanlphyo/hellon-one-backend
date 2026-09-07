import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignClassSubjectDto {
  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @IsUUID()
  @IsNotEmpty()
  teacherId: string;
}
