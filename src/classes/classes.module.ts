import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { ClassSubject } from './entities/class-subject.entity';
import { Class } from './entities/class.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Class, School, User, Subject, ClassSubject]),
  ],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService, TypeOrmModule],
})
export class ClassesModule {}
