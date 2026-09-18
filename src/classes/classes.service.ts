import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { AssignClassSubjectDto } from './dto/assign-class-subject.dto';
import { AssignSchoolDto } from './dto/assign-school.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { QueryClassDto } from './dto/query-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ClassSubject } from './entities/class-subject.entity';
import { Class } from './entities/class.entity';

@Injectable()
export class ClassesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    @InjectRepository(Class)
    private readonly classRepository: Repository<Class>,
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
    @InjectRepository(ClassSubject)
    private readonly classSubjectRepository: Repository<ClassSubject>,
  ) {}

  async onApplicationBootstrap() {
    // Auto-seeding disabled to keep database clean
  }

  async seedDefaultClasses() {
    const count = await this.classRepository.count();
    if (count > 0) return;

    this.logger.log('Seeding initial academic classes...');
    const schools = await this.schoolRepository.find();
    if (schools.length === 0) return;

    const school1 = schools[0];
    const school2 = schools[1] || schools[0];

    const seedClasses = [
      {
        name: 'Grade 9 - Section Alpha',
        gradeLevel: 'Grade 9',
        academicYear: '2026-2027',
        status: 'active' as const,
        schoolId: school1.id,
      },
      {
        name: 'Grade 10 - Section Beta',
        gradeLevel: 'Grade 10',
        academicYear: '2026-2027',
        status: 'active' as const,
        schoolId: school1.id,
      },
      {
        name: 'Grade 11 - Advanced STEM',
        gradeLevel: 'Grade 11',
        academicYear: '2026-2027',
        status: 'active' as const,
        schoolId: school1.id,
      },
      {
        name: 'Grade 10 - Humanities & Arts',
        gradeLevel: 'Grade 10',
        academicYear: '2026-2027',
        status: 'active' as const,
        schoolId: school2.id,
      },
    ];

    for (const item of seedClasses) {
      const cls = this.classRepository.create(item);
      await this.classRepository.save(cls);
    }
    this.logger.log('Initial academic classes seeded successfully.');
  }

  /**
   * Helper to validate teacher exclusivity with a target school.
   * If teacher has no school, automatically assigns them to targetSchoolId.
   */
  private async validateAndAssignTeacherToSchool(
    teacherId: string,
    targetSchoolId: string | null,
  ): Promise<User> {
    const teacher = await this.userRepository.findOne({
      where: { id: teacherId },
      relations: { school: true },
    });

    if (!teacher || teacher.role !== 'teacher') {
      throw new BadRequestException('Selected user is not a valid teacher');
    }

    if (teacher.status === 'suspend') {
      throw new BadRequestException('Selected teacher account is suspended');
    }

    if (targetSchoolId) {
      if (teacher.schoolId && teacher.schoolId !== targetSchoolId) {
        const schoolName = teacher.school?.name || 'another school';
        throw new BadRequestException(
          `Validation Error: Teacher '${teacher.fullName}' is already assigned to '${schoolName}'. A teacher cannot be assigned to classes in a different school.`,
        );
      }

      if (!teacher.schoolId) {
        this.logger.log(
          `Automatically assigning teacher "${teacher.fullName}" to school ID ${targetSchoolId}`,
        );
        teacher.schoolId = targetSchoolId;
        await this.userRepository.save(teacher);
      }
    }

    return teacher;
  }

  async create(dto: CreateClassDto) {
    this.logger.log(
      `Creating class "${dto.name}" [Grade: ${dto.gradeLevel}, School: ${dto.schoolId || 'None'}]`,
    );

    if (dto.schoolId) {
      const school = await this.schoolRepository.findOneBy({ id: dto.schoolId });
      if (!school) {
        throw new BadRequestException('Specified school does not exist');
      }
    }

    if (dto.teacherId) {
      await this.validateAndAssignTeacherToSchool(
        dto.teacherId,
        dto.schoolId || null,
      );
    }

    const cls = this.classRepository.create({
      name: dto.name.trim(),
      gradeLevel: dto.gradeLevel.trim(),
      academicYear: dto.academicYear?.trim() || '2026-2027',
      schoolId: dto.schoolId || null,
      teacherId: dto.teacherId || null,
      status: 'active',
    });

    const saved = await this.classRepository.save(cls);
    this.logger.log(`Class created successfully with ID: ${saved.id}`);

    return {
      isSuccess: true,
      message: 'Class created successfully',
      data: saved,
    };
  }

  async findAll(query: QueryClassDto) {
    this.logger.log(
      `Fetching classes [School: ${query.schoolId || 'all'}, Grade: ${query.gradeLevel || 'all'}, Year: ${query.academicYear || 'all'}]`,
    );

    const qb = this.classRepository
      .createQueryBuilder('class')
      .leftJoinAndSelect('class.school', 'school')
      .leftJoinAndSelect('class.teacher', 'teacher')
      .leftJoinAndSelect('class.classSubjects', 'classSubject')
      .leftJoinAndSelect('classSubject.subject', 'subject')
      .leftJoinAndSelect('classSubject.teacher', 'subjectTeacher')
      .orderBy('class.gradeLevel', 'ASC')
      .addOrderBy('class.name', 'ASC');

    if (query.schoolId && query.schoolId !== 'default' && query.schoolId !== 'all') {
      qb.andWhere('class.schoolId = :schoolId', { schoolId: query.schoolId });
    }

    if (query.gradeLevel && query.gradeLevel !== 'default' && query.gradeLevel !== 'all') {
      qb.andWhere('class.gradeLevel = :gradeLevel', {
        gradeLevel: query.gradeLevel,
      });
    }

    if (query.academicYear && query.academicYear !== 'default' && query.academicYear !== 'all') {
      qb.andWhere('class.academicYear = :academicYear', {
        academicYear: query.academicYear,
      });
    }

    const classes = await qb.getMany();

    return {
      isSuccess: true,
      total: classes.length,
      data: classes,
    };
  }

  async findOne(id: string) {
    this.logger.log(`Fetching class by ID: ${id}`);
    const cls = await this.classRepository.findOne({
      where: { id },
      relations: {
        school: true,
        teacher: true,
        classSubjects: {
          subject: true,
          teacher: true,
        },
      },
    });

    if (!cls) {
      throw new NotFoundException('Class not found');
    }

    return {
      isSuccess: true,
      data: cls,
    };
  }

  async assignSchool(id: string, dto: AssignSchoolDto) {
    this.logger.log(`Assigning class ID ${id} to school ID ${dto.schoolId}`);

    const cls = await this.classRepository.findOne({
      where: { id },
      relations: { teacher: true, classSubjects: { teacher: true } },
    });
    if (!cls) {
      throw new NotFoundException('Class not found');
    }

    const school = await this.schoolRepository.findOneBy({ id: dto.schoolId });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    if (cls.teacherId) {
      await this.validateAndAssignTeacherToSchool(cls.teacherId, school.id);
    }

    if (cls.classSubjects && cls.classSubjects.length > 0) {
      for (const cs of cls.classSubjects) {
        if (cs.teacherId) {
          await this.validateAndAssignTeacherToSchool(cs.teacherId, school.id);
        }
      }
    }

    cls.schoolId = school.id;
    const updated = await this.classRepository.save(cls);

    return {
      isSuccess: true,
      message: `Class successfully assigned to ${school.name}`,
      data: updated,
    };
  }

  async update(id: string, dto: UpdateClassDto) {
    this.logger.log(`Updating class ID: ${id}`);
    const cls = await this.classRepository.findOneBy({ id });
    if (!cls) {
      throw new NotFoundException('Class not found');
    }

    const targetSchoolId =
      dto.schoolId !== undefined ? dto.schoolId : cls.schoolId;

    if (dto.schoolId !== undefined) {
      if (dto.schoolId !== null) {
        const school = await this.schoolRepository.findOneBy({
          id: dto.schoolId,
        });
        if (!school) {
          throw new BadRequestException('Target school does not exist');
        }
        cls.schoolId = school.id;
      } else {
        cls.schoolId = null;
      }
    }

    if (dto.teacherId !== undefined) {
      if (dto.teacherId !== null) {
        await this.validateAndAssignTeacherToSchool(
          dto.teacherId,
          targetSchoolId,
        );
        cls.teacherId = dto.teacherId;
      } else {
        cls.teacherId = null;
      }
    }

    if (dto.name) cls.name = dto.name.trim();
    if (dto.gradeLevel) cls.gradeLevel = dto.gradeLevel.trim();
    if (dto.academicYear) cls.academicYear = dto.academicYear.trim();
    if (dto.status) cls.status = dto.status;

    const updated = await this.classRepository.save(cls);
    return {
      isSuccess: true,
      message: 'Class updated successfully',
      data: updated,
    };
  }

  /**
   * Assigns a subject and teacher to a class with curriculum & exclusivity validation.
   */
  async assignSubjectTeacher(classId: string, dto: AssignClassSubjectDto) {
    const cls = await this.classRepository.findOne({
      where: { id: classId },
      relations: { school: { subjects: true } },
    });

    if (!cls) {
      throw new NotFoundException('Class not found');
    }

    if (!cls.schoolId || !cls.school) {
      throw new BadRequestException(
        'Please assign this class to a school before assigning subjects and teachers.',
      );
    }

    const subject = await this.subjectRepository.findOneBy({
      id: dto.subjectId,
    });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    const schoolOffersSubject = cls.school.subjects?.some(
      (s) => s.id === subject.id,
    );
    if (!schoolOffersSubject) {
      throw new BadRequestException(
        `Subject '${subject.name}' is not currently offered by ${cls.school.name}. Please add this subject to the school curriculum first.`,
      );
    }

    await this.validateAndAssignTeacherToSchool(dto.teacherId, cls.schoolId);

    let classSubject = await this.classSubjectRepository.findOneBy({
      classId,
      subjectId: dto.subjectId,
    });

    if (!classSubject) {
      classSubject = this.classSubjectRepository.create({
        classId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
      });
    } else {
      classSubject.teacherId = dto.teacherId;
    }

    const saved = await this.classSubjectRepository.save(classSubject);

    const populated = await this.classSubjectRepository.findOne({
      where: { id: saved.id },
      relations: { subject: true, teacher: true },
    });

    return {
      isSuccess: true,
      message: `Assigned ${subject.name} to teacher for class ${cls.name}`,
      data: populated ?? saved,
    };
  }

  async getClassSubjects(classId: string) {
    const classSubjects = await this.classSubjectRepository.find({
      where: { classId },
      relations: { subject: true, teacher: true },
      order: { subject: { name: 'ASC' } },
    });

    return {
      isSuccess: true,
      data: classSubjects,
    };
  }

  async removeClassSubject(classId: string, subjectId: string) {
    const existing = await this.classSubjectRepository.findOneBy({
      classId,
      subjectId,
    });

    if (!existing) {
      throw new NotFoundException('Class subject assignment not found');
    }

    await this.classSubjectRepository.remove(existing);
    return {
      isSuccess: true,
      message: 'Subject removed from class successfully',
    };
  }
}
