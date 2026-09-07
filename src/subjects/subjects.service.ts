import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { Subject } from './entities/subject.entity';

@Injectable()
export class SubjectsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SubjectsService.name);

  constructor(
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedDefaultSubjects();
  }

  async seedDefaultSubjects() {
    const count = await this.subjectRepository.count();
    if (count > 0) return;

    this.logger.log('Seeding initial academic subjects...');
    const defaultSubjects = [
      { name: 'Mathematics', code: 'MATH-10' },
      { name: 'English Language & Literature', code: 'ENG-10' },
      { name: 'Physics', code: 'PHYS-11' },
      { name: 'Chemistry', code: 'CHEM-11' },
      { name: 'Biology', code: 'BIO-10' },
      { name: 'World History', code: 'HIST-09' },
      { name: 'Computer Science & ICT', code: 'CS-10' },
      { name: 'Art & Design', code: 'ART-08' },
      { name: 'Physical Education', code: 'PE-01' },
    ];

    for (const sub of defaultSubjects) {
      const subject = this.subjectRepository.create({
        ...sub,
        status: 'active',
      });
      await this.subjectRepository.save(subject);
    }
    this.logger.log('Initial academic subjects seeded successfully.');
  }

  async findAll() {
    this.logger.log('Fetching all subjects catalog');
    const subjects = await this.subjectRepository.find({
      order: { name: 'ASC' },
    });

    return {
      isSuccess: true,
      total: subjects.length,
      data: subjects,
    };
  }

  async findOne(id: string) {
    const subject = await this.subjectRepository.findOneBy({ id });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    return {
      isSuccess: true,
      data: subject,
    };
  }

  async create(dto: CreateSubjectDto) {
    const codeExists = await this.subjectRepository.findOneBy({
      code: dto.code.trim().toUpperCase(),
    });
    if (codeExists) {
      throw new BadRequestException(
        `Subject with code '${dto.code}' already exists`,
      );
    }

    const nameExists = await this.subjectRepository.findOneBy({
      name: dto.name.trim(),
    });
    if (nameExists) {
      throw new BadRequestException(
        `Subject with name '${dto.name}' already exists`,
      );
    }

    const subject = this.subjectRepository.create({
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      status: 'active',
    });

    const saved = await this.subjectRepository.save(subject);
    return {
      isSuccess: true,
      message: 'Subject created successfully',
      data: saved,
    };
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const subject = await this.subjectRepository.findOneBy({ id });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    if (dto.code && dto.code !== subject.code) {
      const codeExists = await this.subjectRepository.findOneBy({
        code: dto.code.trim().toUpperCase(),
      });
      if (codeExists && codeExists.id !== id) {
        throw new BadRequestException(
          `Subject with code '${dto.code}' already exists`,
        );
      }
      subject.code = dto.code.trim().toUpperCase();
    }

    if (dto.name && dto.name !== subject.name) {
      const nameExists = await this.subjectRepository.findOneBy({
        name: dto.name.trim(),
      });
      if (nameExists && nameExists.id !== id) {
        throw new BadRequestException(
          `Subject with name '${dto.name}' already exists`,
        );
      }
      subject.name = dto.name.trim();
    }

    if (dto.status) {
      subject.status = dto.status;
    }

    const saved = await this.subjectRepository.save(subject);
    return {
      isSuccess: true,
      message: 'Subject updated successfully',
      data: saved,
    };
  }
}
