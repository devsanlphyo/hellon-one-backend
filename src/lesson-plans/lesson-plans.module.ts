import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { Class } from '../classes/entities/class.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { LeaveRequest } from '../leaves/entities/leave-request.entity';
import { TeacherShift } from '../shifts/entities/teacher-shift.entity';
import { LessonPlan } from './entities/lesson-plan.entity';
import { LessonPlansController } from './lesson-plans.controller';
import { LessonPlansService } from './lesson-plans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonPlan,
      User,
      School,
      Class,
      Subject,
      LeaveRequest,
      TeacherShift,
    ]),
  ],
  controllers: [LessonPlansController],
  providers: [LessonPlansService],
  exports: [LessonPlansService],
})
export class LessonPlansModule {}
