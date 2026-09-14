import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/entities/user.entity';
import { UserDevice } from './auth/entities/user-device.entity';
import { ClassesModule } from './classes/classes.module';
import { ClassSubject } from './classes/entities/class-subject.entity';
import { Class } from './classes/entities/class.entity';
import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';
import { School } from './schools/entities/school.entity';
import { SchoolsModule } from './schools/schools.module';
import { AppSettings } from './settings/entities/settings.entity';
import { SettingsModule } from './settings/settings.module';
import { Shift } from './shifts/entities/shift.entity';
import { TeacherAttendance } from './shifts/entities/teacher-attendance.entity';
import { TeacherShift } from './shifts/entities/teacher-shift.entity';
import { ShiftsModule } from './shifts/shifts.module';
import { LeaveRequest } from './leaves/entities/leave-request.entity';
import { LeavesModule } from './leaves/leaves.module';
import { Subject } from './subjects/entities/subject.entity';
import { SubjectsModule } from './subjects/subjects.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'hello_one',
      synchronize: true,
      entities: [
        User,
        UserDevice,
        School,
        Class,
        Subject,
        ClassSubject,
        AppSettings,
        Shift,
        TeacherShift,
        TeacherAttendance,
        LeaveRequest,
      ],
    }),

    AuthModule,
    UsersModule,
    SchoolsModule,
    ClassesModule,
    SubjectsModule,
    SettingsModule,
    ShiftsModule,
    LeavesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
