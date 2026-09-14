import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { LeaveRequest } from '../leaves/entities/leave-request.entity';
import { Shift } from './entities/shift.entity';
import { TeacherAttendance } from './entities/teacher-attendance.entity';
import { TeacherShift } from './entities/teacher-shift.entity';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shift,
      TeacherShift,
      TeacherAttendance,
      User,
      LeaveRequest,
    ]),
  ],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
