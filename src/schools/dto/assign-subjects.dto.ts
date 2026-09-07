import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AssignSchoolSubjectsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  subjectIds: string[];
}
