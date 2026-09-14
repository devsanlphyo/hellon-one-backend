import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LessonPlanStatus } from '../entities/lesson-plan.entity';

export class ReviewLessonPlanDto {
  @IsNotEmpty()
  @IsIn(['reviewed', 'needs_revision'])
  status: Extract<LessonPlanStatus, 'reviewed' | 'needs_revision'>;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
