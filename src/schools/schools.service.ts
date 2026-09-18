import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { AssignSchoolSubjectsDto } from './dto/assign-subjects.dto';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { School } from './entities/school.entity';

@Injectable()
export class SchoolsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
  ) {}

  async onApplicationBootstrap() {
    // Auto-seeding disabled to keep database clean
  }

  async seedDefaultSchools() {
    const count = await this.schoolRepository.count();
    if (count > 0) return;

    this.logger.log('Seeding initial schools...');
    const seedSchools = [
      {
        name: 'Oakridge High School',
        code: 'SCH-OAK-01',
        principalName: 'Dr. Evelyn Montgomery',
        status: 'active' as const,
      },
      {
        name: 'Beacon Valley International Academy',
        code: 'SCH-BVA-02',
        principalName: 'Prof. Marcus Vance',
        status: 'active' as const,
      },
      {
        name: 'St. Jude Preparatory School',
        code: 'SCH-SJP-03',
        principalName: 'Sr. Beatrice Callahan',
        status: 'active' as const,
      },
    ];

    for (const schoolData of seedSchools) {
      const school = this.schoolRepository.create(schoolData);
      await this.schoolRepository.save(school);
    }
    this.logger.log('Initial schools seeded successfully.');
  }

  async create(dto: CreateSchoolDto) {
    this.logger.log(`Creating new school: "${dto.name}" [Code: ${dto.code}]`);

    const existingCode = await this.schoolRepository.findOneBy({
      code: dto.code.trim().toUpperCase(),
    });
    if (existingCode) {
      throw new BadRequestException(
        `School with code '${dto.code}' already exists`,
      );
    }

    const existingName = await this.schoolRepository.findOneBy({
      name: dto.name.trim(),
    });
    if (existingName) {
      throw new BadRequestException(
        `School with name '${dto.name}' already exists`,
      );
    }

    let principalName = dto.principalName?.trim();

    if (dto.headmasterId) {
      const headmaster = await this.userRepository.findOneBy({
        id: dto.headmasterId,
      });
      if (!headmaster || headmaster.role !== 'headmaster') {
        throw new BadRequestException('Selected user is not a valid headmaster');
      }
      principalName = headmaster.fullName;
    }

    const school = this.schoolRepository.create({
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      principalName,
      headmasterId: dto.headmasterId || null,
      status: 'active',
    });

    const saved = await this.schoolRepository.save(school);

    if (dto.headmasterId) {
      await this.userRepository.update(dto.headmasterId, {
        schoolId: saved.id,
      });
    }

    return {
      isSuccess: true,
      message: 'School created successfully',
      data: saved,
    };
  }

  async findAll() {
    this.logger.log('Fetching all schools list (no pagination)');
    const schools = await this.schoolRepository
      .createQueryBuilder('school')
      .leftJoinAndSelect('school.classes', 'class')
      .leftJoinAndSelect('school.headmaster', 'headmaster')
      .leftJoinAndSelect('school.subjects', 'subject')
      .orderBy('school.createdAt', 'ASC')
      .getMany();

    const formatted = schools.map((school) => ({
      ...school,
      classesCount: school.classes?.length || 0,
      subjectsCount: school.subjects?.length || 0,
    }));

    return {
      isSuccess: true,
      total: formatted.length,
      data: formatted,
    };
  }

  async findOne(id: string) {
    this.logger.log(`Fetching school detail for ID: ${id}`);
    const school = await this.schoolRepository.findOne({
      where: { id },
      relations: {
        classes: true,
        headmaster: true,
        subjects: true,
        staff: true,
      },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return {
      isSuccess: true,
      data: school,
    };
  }

  async update(id: string, dto: UpdateSchoolDto) {
    this.logger.log(`Updating school ID: ${id}`);
    const school = await this.schoolRepository.findOneBy({ id });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    if (dto.code && dto.code !== school.code) {
      const codeExists = await this.schoolRepository.findOneBy({
        code: dto.code.trim().toUpperCase(),
      });
      if (codeExists && codeExists.id !== id) {
        throw new BadRequestException(
          `School with code '${dto.code}' already exists`,
        );
      }
      school.code = dto.code.trim().toUpperCase();
    }

    if (dto.name && dto.name !== school.name) {
      const nameExists = await this.schoolRepository.findOneBy({
        name: dto.name.trim(),
      });
      if (nameExists && nameExists.id !== id) {
        throw new BadRequestException(
          `School with name '${dto.name}' already exists`,
        );
      }
      school.name = dto.name.trim();
    }

    if (dto.headmasterId !== undefined) {
      if (dto.headmasterId !== null) {
        const headmaster = await this.userRepository.findOneBy({
          id: dto.headmasterId,
        });
        if (!headmaster || headmaster.role !== 'headmaster') {
          throw new BadRequestException(
            'Selected user is not a valid headmaster',
          );
        }
        school.headmasterId = headmaster.id;
        school.principalName = headmaster.fullName;
        await this.userRepository.update(headmaster.id, { schoolId: school.id });
      } else {
        school.headmasterId = null;
      }
    }

    if (dto.principalName !== undefined && !dto.headmasterId) {
      school.principalName = dto.principalName.trim();
    }

    if (dto.status) {
      school.status = dto.status;
    }

    const updated = await this.schoolRepository.save(school);
    return {
      isSuccess: true,
      message: 'School updated successfully',
      data: updated,
    };
  }

  async getSchoolSubjects(schoolId: string) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      relations: { subjects: true },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return {
      isSuccess: true,
      data: school.subjects || [],
    };
  }

  async assignSchoolSubjects(schoolId: string, dto: AssignSchoolSubjectsDto) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      relations: { subjects: true },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    const subjects = await this.subjectRepository.findBy({
      id: In(dto.subjectIds),
    });

    school.subjects = subjects;
    const saved = await this.schoolRepository.save(school);

    return {
      isSuccess: true,
      message: `Assigned ${subjects.length} subjects to ${school.name}`,
      data: saved.subjects,
    };
  }
}
