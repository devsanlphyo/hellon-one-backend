import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { QueryLeavesDto } from './dto/query-leaves.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { LeaveRequest, LeaveStatus } from './entities/leave-request.entity';

@Injectable()
export class LeavesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LeavesService.name);

  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRepo: Repository<LeaveRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  async onApplicationBootstrap() {
    // Auto-seeding disabled to keep database clean
  }

  private async seedInitialLeaveRequests() {
    const count = await this.leaveRepo.count();
    if (count > 0) {
      return;
    }

    const teachers = await this.userRepo.find({
      where: { role: 'teacher' },
      take: 4,
    });
    if (teachers.length === 0) {
      return;
    }

    const headmaster = await this.userRepo.findOne({
      where: { role: 'headmaster' },
    });

    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const sampleRequests = [
      {
        user: teachers[0],
        schoolId: teachers[0].schoolId,
        startDate: formatDate(
          new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
        ),
        endDate: formatDate(
          new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
        ),
        reason:
          'Attending national STEM educational conference and workshop presentations.',
        status: 'pending' as LeaveStatus,
      },
      {
        user: teachers[1] || teachers[0],
        schoolId: (teachers[1] || teachers[0]).schoolId,
        startDate: formatDate(
          new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
        ),
        endDate: formatDate(
          new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
        ),
        reason:
          'Medical appointment and follow-up consultation with specialist.',
        status: 'approved' as LeaveStatus,
        reviewedById: headmaster ? headmaster.id : null,
        reviewNotes: 'Approved. Relieving coverage arranged with Grade 10 team.',
        reviewedAt: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
      },
      {
        user: teachers[2] || teachers[0],
        schoolId: (teachers[2] || teachers[0]).schoolId,
        startDate: formatDate(
          new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000),
        ),
        endDate: formatDate(
          new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000),
        ),
        reason: 'Personal family emergency travel outside municipal area.',
        status: 'rejected' as LeaveStatus,
        reviewedById: headmaster ? headmaster.id : null,
        reviewNotes:
          'Critical mid-term exam schedule conflicts with requested dates.',
        reviewedAt: new Date(today.getTime() - 11 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const req of sampleRequests) {
      const entity = this.leaveRepo.create({
        userId: req.user.id,
        schoolId: req.schoolId,
        startDate: req.startDate,
        endDate: req.endDate,
        reason: req.reason,
        status: req.status,
        reviewedById: req.reviewedById || null,
        reviewNotes: req.reviewNotes || null,
        reviewedAt: req.reviewedAt || null,
      });
      await this.leaveRepo.save(entity);
    }

    this.logger.log('Seeded sample leave requests for testing.');
  }

  async createLeaveRequest(
    userId: string,
    dto: CreateLeaveRequestDto,
  ): Promise<LeaveRequest> {
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('End date must be on or after start date');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { school: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const leave = this.leaveRepo.create({
      userId,
      schoolId: user.schoolId || null,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason.trim(),
      status: 'pending',
    });

    const saved = await this.leaveRepo.save(leave);
    return this.getLeaveById(saved.id);
  }

  async getMyLeaveRequests(userId: string): Promise<LeaveRequest[]> {
    return this.leaveRepo.find({
      where: { userId },
      relations: {
        user: true,
        reviewedBy: true,
        school: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getSchoolLeaveRequests(
    schoolId: string,
    status?: LeaveStatus,
  ): Promise<LeaveRequest[]> {
    const whereClause: any = { schoolId };
    if (status) {
      whereClause.status = status;
    }

    return this.leaveRepo.find({
      where: whereClause,
      relations: {
        user: true,
        reviewedBy: true,
        school: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllLeaveRequests(query: QueryLeavesDto): Promise<LeaveRequest[]> {
    const qb = this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.user', 'user')
      .leftJoinAndSelect('leave.reviewedBy', 'reviewedBy')
      .leftJoinAndSelect('leave.school', 'school')
      .orderBy('leave.createdAt', 'DESC');

    if (query.schoolId) {
      qb.andWhere('leave.schoolId = :schoolId', { schoolId: query.schoolId });
    }

    if (query.status) {
      qb.andWhere('leave.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(user.fullName ILIKE :search OR user.email ILIKE :search OR leave.reason ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    return qb.getMany();
  }

  async getLeaveById(id: string): Promise<LeaveRequest> {
    const leave = await this.leaveRepo.findOne({
      where: { id },
      relations: {
        user: true,
        reviewedBy: true,
        school: true,
      },
    });

    if (!leave) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }

    return leave;
  }

  async updateLeaveStatus(
    id: string,
    reviewerId: string,
    dto: UpdateLeaveStatusDto,
  ): Promise<LeaveRequest> {
    const leave = await this.getLeaveById(id);

    leave.status = dto.status;
    leave.reviewedById = reviewerId;
    leave.reviewNotes = dto.reviewNotes?.trim() || null;
    leave.reviewedAt = new Date();

    await this.leaveRepo.save(leave);
    return this.getLeaveById(id);
  }

  async getLeaveStats(schoolId?: string) {
    const qb = this.leaveRepo.createQueryBuilder('leave');

    if (schoolId) {
      qb.where('leave.schoolId = :schoolId', { schoolId });
    }

    const all = await qb.getMany();
    const today = new Date().toISOString().split('T')[0];

    const total = all.length;
    const pending = all.filter((l) => l.status === 'pending').length;
    const approved = all.filter((l) => l.status === 'approved').length;
    const rejected = all.filter((l) => l.status === 'rejected').length;

    const onLeaveToday = all.filter(
      (l) => l.status === 'approved' && l.startDate <= today && l.endDate >= today,
    ).length;

    return {
      total,
      pending,
      approved,
      rejected,
      onLeaveToday,
    };
  }
}
