import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { Class } from '../classes/entities/class.entity';
import { Subject } from '../subjects/entities/subject.entity';
import { LeaveRequest } from '../leaves/entities/leave-request.entity';
import { TeacherShift } from '../shifts/entities/teacher-shift.entity';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import { QueryLessonPlansDto } from './dto/query-lesson-plans.dto';
import { ReviewLessonPlanDto } from './dto/review-lesson-plan.dto';
import { LessonPlan } from './entities/lesson-plan.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LessonPlansService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LessonPlansService.name);

  constructor(
    @InjectRepository(LessonPlan)
    private readonly lessonPlanRepository: Repository<LessonPlan>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(Class)
    private readonly classRepository: Repository<Class>,
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRepository: Repository<LeaveRequest>,
    @InjectRepository(TeacherShift)
    private readonly teacherShiftRepository: Repository<TeacherShift>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedInitialLessonPlans();
  }

  private getLocalDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Evaluates the flowchart decision gates for a teacher on a specific date:
   * 1. IsLeaveDay? -> Check approved leave requests in DB
   * 2. IsDutyDay?  -> Check active shift assignment & schedule
   */
  async getDailyStatus(userId: string, targetDate?: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { school: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const date = targetDate || this.getLocalDateString();

    // 1. IsLeaveDay? - Check for approved leave covering this date
    const approvedLeave = await this.leaveRepository
      .createQueryBuilder('leave')
      .where('leave.userId = :userId', { userId })
      .andWhere('leave.status = :status', { status: 'approved' })
      .andWhere('leave.startDate <= :date', { date })
      .andWhere('leave.endDate >= :date', { date })
      .getOne();

    const isLeaveDay = Boolean(approvedLeave);

    // 2. IsDutyDay? - Check if teacher has active shift and is a weekday/duty day
    const activeShift = await this.teacherShiftRepository.findOne({
      where: { teacherId: userId, status: 'active' },
      relations: { shift: true },
    });

    const parsedDate = new Date(`${date}T12:00:00Z`);
    const dayOfWeek = parsedDate.getUTCDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // A duty day is when teacher has an active shift and it's not weekend
    const isDutyDay = Boolean(activeShift) && !isWeekend;

    // Fetch existing submitted lesson plans for this date
    const todayPlans = await this.lessonPlanRepository.find({
      where: { teacherId: userId, date },
      relations: {
        class: true,
        subject: true,
        reviewedBy: true,
      },
      order: { createdAt: 'DESC' },
    });

    return {
      date,
      teacher: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        schoolName: user.school?.name || 'Main Campus',
      },
      isLeaveDay,
      leaveDetails: approvedLeave
        ? {
            id: approvedLeave.id,
            startDate: approvedLeave.startDate,
            endDate: approvedLeave.endDate,
            reason: approvedLeave.reason,
            reviewedAt: approvedLeave.reviewedAt,
          }
        : null,
      isDutyDay,
      shiftDetails: activeShift?.shift
        ? {
            id: activeShift.shift.id,
            name: activeShift.shift.name,
            code: activeShift.shift.code,
            startTime: activeShift.shift.startTime,
            endTime: activeShift.shift.endTime,
            color: activeShift.shift.color,
          }
        : null,
      todayPlans,
      isExempted: isLeaveDay || !isDutyDay,
      hasSubmitted: todayPlans.length > 0,
    };
  }

  /**
   * Submit a new lesson plan with optional document attachment (up to 100MB)
   */
  async submitLessonPlan(
    teacherId: string,
    dto: CreateLessonPlanDto,
    file?: Express.Multer.File,
  ) {
    const teacher = await this.userRepository.findOne({
      where: { id: teacherId },
      relations: { school: true },
    });
    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${teacherId} not found`);
    }

    // Verify IsDutyDay or active shift start time for late calculation
    const activeShift = await this.teacherShiftRepository.findOne({
      where: { teacherId, status: 'active' },
      relations: { shift: true },
    });

    const targetDate = dto.date;
    const today = this.getLocalDateString();

    let isLate = false;
    if (targetDate < today) {
      isLate = true;
    } else if (targetDate === today) {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const shiftStartTime = activeShift?.shift?.startTime || '09:00';
      const [startHour, startMin] = shiftStartTime.split(':').map(Number);

      if (
        currentHours > startHour ||
        (currentHours === startHour && currentMinutes > startMin)
      ) {
        isLate = true;
      }
    }

    const plan = this.lessonPlanRepository.create({
      teacherId,
      schoolId: teacher.schoolId,
      classId: dto.classId || null,
      subjectId: dto.subjectId || null,
      date: targetDate,
      title: dto.title,
      topic: dto.topic || null,
      objectives: dto.objectives || null,
      isLate,
      justification: dto.justification || null,
      status: 'pending',
      fileUrl: file ? `/uploads/lesson-plans/${file.filename}` : null,
      fileName: file ? file.originalname : null,
      fileSize: file ? file.size : null,
      mimeType: file ? file.mimetype : null,
    });

    const saved = await this.lessonPlanRepository.save(plan);

    return this.lessonPlanRepository.findOne({
      where: { id: saved.id },
      relations: {
        teacher: true,
        school: true,
        class: true,
        subject: true,
      },
    });
  }

  /**
   * Get submission history for the logged-in teacher
   */
  async getTeacherPlans(teacherId: string, query?: QueryLessonPlansDto) {
    const qb = this.lessonPlanRepository
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.school', 'school')
      .leftJoinAndSelect('plan.class', 'class')
      .leftJoinAndSelect('plan.subject', 'subject')
      .leftJoinAndSelect('plan.reviewedBy', 'reviewer')
      .where('plan.teacherId = :teacherId', { teacherId });

    if (query?.date) {
      qb.andWhere('plan.date = :date', { date: query.date });
    }

    if (query?.status && query.status !== 'all') {
      qb.andWhere('plan.status = :status', { status: query.status });
    }

    if (query?.search) {
      qb.andWhere(
        '(LOWER(plan.title) LIKE :search OR LOWER(plan.topic) LIKE :search OR LOWER(plan.objectives) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    const plans = await qb.orderBy('plan.date', 'DESC').addOrderBy('plan.createdAt', 'DESC').getMany();
    return plans;
  }

  /**
   * Campus view for Headmaster:
   * Returns list of submitted lesson plans and institutional compliance summary
   */
  async getCampusPlans(schoolId: string, query?: QueryLessonPlansDto) {
    const date = query?.date || this.getLocalDateString();

    // 1. Get all active teachers in this school
    const teachers = await this.userRepository.find({
      where: { schoolId, role: 'teacher', status: 'active' },
      order: { fullName: 'ASC' },
    });

    // 2. Query approved leaves for target date
    const approvedLeaves = await this.leaveRepository
      .createQueryBuilder('leave')
      .where('leave.schoolId = :schoolId', { schoolId })
      .andWhere('leave.status = :status', { status: 'approved' })
      .andWhere('leave.startDate <= :date', { date })
      .andWhere('leave.endDate >= :date', { date })
      .getMany();

    const leaveTeacherIds = new Set(approvedLeaves.map((l) => l.userId));

    // 3. Query active shifts to identify duty days
    const activeShifts = await this.teacherShiftRepository.find({
      where: { status: 'active' },
      relations: { shift: true },
    });
    const shiftTeacherIds = new Set(activeShifts.map((s) => s.teacherId));

    // 4. Query submitted plans for this school
    const plansQb = this.lessonPlanRepository
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.teacher', 'teacher')
      .leftJoinAndSelect('plan.class', 'class')
      .leftJoinAndSelect('plan.subject', 'subject')
      .leftJoinAndSelect('plan.reviewedBy', 'reviewer')
      .where('plan.schoolId = :schoolId', { schoolId });

    if (query?.date) {
      plansQb.andWhere('plan.date = :date', { date: query.date });
    }

    if (query?.status && query.status !== 'all') {
      plansQb.andWhere('plan.status = :status', { status: query.status });
    }

    if (query?.search) {
      plansQb.andWhere(
        '(LOWER(plan.title) LIKE :search OR LOWER(teacher.fullName) LIKE :search OR LOWER(plan.topic) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    const plans = await plansQb.orderBy('plan.date', 'DESC').addOrderBy('plan.createdAt', 'DESC').getMany();

    // Calculate campus KPI statistics for target date
    const todayPlans = await this.lessonPlanRepository.find({
      where: { schoolId, date },
    });
    const submittedTeacherIds = new Set(todayPlans.map((p) => p.teacherId));

    const totalTeachers = teachers.length;
    const excusedOnLeaveCount = teachers.filter((t) => leaveTeacherIds.has(t.id)).length;
    const submittedCount = todayPlans.length;
    const pendingReviewCount = todayPlans.filter((p) => p.status === 'pending').length;
    const reviewedCount = todayPlans.filter((p) => p.status === 'reviewed').length;

    // Missing = teachers on duty who are NOT on leave and haven't submitted today
    const missingCount = teachers.filter(
      (t) =>
        shiftTeacherIds.has(t.id) &&
        !leaveTeacherIds.has(t.id) &&
        !submittedTeacherIds.has(t.id),
    ).length;

    return {
      date,
      summary: {
        totalTeachers,
        submittedCount,
        excusedOnLeaveCount,
        missingCount,
        pendingReviewCount,
        reviewedCount,
        complianceRate:
          totalTeachers > 0
            ? Math.round(((submittedCount + excusedOnLeaveCount) / totalTeachers) * 100)
            : 100,
      },
      plans,
      excusedStaff: approvedLeaves.map((l) => ({
        leaveId: l.id,
        teacherId: l.userId,
        reason: l.reason,
        startDate: l.startDate,
        endDate: l.endDate,
      })),
    };
  }

  /**
   * Multi-campus overview for Director
   */
  async getAllPlans(query?: QueryLessonPlansDto) {
    const date = query?.date || this.getLocalDateString();

    const schools = await this.schoolRepository.find({
      order: { name: 'ASC' },
    });

    const qb = this.lessonPlanRepository
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.teacher', 'teacher')
      .leftJoinAndSelect('plan.school', 'school')
      .leftJoinAndSelect('plan.class', 'class')
      .leftJoinAndSelect('plan.subject', 'subject')
      .leftJoinAndSelect('plan.reviewedBy', 'reviewer');

    if (query?.schoolId) {
      qb.andWhere('plan.schoolId = :schoolId', { schoolId: query.schoolId });
    }

    if (query?.date) {
      qb.andWhere('plan.date = :date', { date: query.date });
    }

    if (query?.status && query.status !== 'all') {
      qb.andWhere('plan.status = :status', { status: query.status });
    }

    if (query?.search) {
      qb.andWhere(
        '(LOWER(plan.title) LIKE :search OR LOWER(teacher.fullName) LIKE :search OR LOWER(school.name) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    const plans = await qb.orderBy('plan.date', 'DESC').addOrderBy('plan.createdAt', 'DESC').getMany();

    // Institutional breakdown per school
    const campusMetrics = await Promise.all(
      schools.map(async (sch) => {
        const campusPlans = await this.lessonPlanRepository.find({
          where: { schoolId: sch.id, date },
        });

        const teacherCount = await this.userRepository.count({
          where: { schoolId: sch.id, role: 'teacher', status: 'active' },
        });

        const approvedLeaves = await this.leaveRepository
          .createQueryBuilder('leave')
          .where('leave.schoolId = :schoolId', { schoolId: sch.id })
          .andWhere('leave.status = :status', { status: 'approved' })
          .andWhere('leave.startDate <= :date', { date })
          .andWhere('leave.endDate >= :date', { date })
          .getCount();

        const submittedCount = campusPlans.length;
        const reviewedCount = campusPlans.filter((p) => p.status === 'reviewed').length;

        return {
          schoolId: sch.id,
          schoolName: sch.name,
          campusCode: sch.code,
          teacherCount,
          submittedCount,
          approvedLeaves,
          reviewedCount,
          complianceRate:
            teacherCount > 0
              ? Math.min(100, Math.round(((submittedCount + approvedLeaves) / teacherCount) * 100))
              : 100,
        };
      }),
    );

    const totalSubmitted = plans.length;
    const totalReviewed = plans.filter((p) => p.status === 'reviewed').length;
    const totalPending = plans.filter((p) => p.status === 'pending').length;

    return {
      date,
      summary: {
        totalCampuses: schools.length,
        totalSubmitted,
        totalReviewed,
        totalPending,
      },
      campusMetrics,
      plans,
    };
  }

  /**
   * Headmaster or Director reviews a lesson plan
   */
  async reviewLessonPlan(
    id: string,
    reviewerId: string,
    dto: ReviewLessonPlanDto,
  ) {
    const plan = await this.lessonPlanRepository.findOne({
      where: { id },
      relations: { teacher: true, school: true },
    });

    if (!plan) {
      throw new NotFoundException(`Lesson plan with ID ${id} not found`);
    }

    plan.status = dto.status;
    plan.reviewNotes = dto.reviewNotes || null;
    plan.reviewedById = reviewerId;
    plan.reviewedAt = new Date();

    await this.lessonPlanRepository.save(plan);

    return this.lessonPlanRepository.findOne({
      where: { id },
      relations: {
        teacher: true,
        school: true,
        class: true,
        subject: true,
        reviewedBy: true,
      },
    });
  }

  /**
   * Cancel / delete a pending lesson plan
   */
  async deleteLessonPlan(id: string, teacherId: string) {
    const plan = await this.lessonPlanRepository.findOne({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Lesson plan with ID ${id} not found`);
    }

    if (plan.teacherId !== teacherId) {
      throw new ForbiddenException('You can only delete your own lesson plans');
    }

    if (plan.status !== 'pending') {
      throw new BadRequestException('Cannot delete a lesson plan that has already been reviewed');
    }

    // Clean up local file if stored
    if (plan.fileUrl && plan.fileUrl.startsWith('/uploads/lesson-plans/')) {
      const filePath = path.join(process.cwd(), 'public', plan.fileUrl);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore unlink error
        }
      }
    }

    await this.lessonPlanRepository.delete(id);
    return { success: true, message: 'Lesson plan deleted successfully' };
  }

  /**
   * Seed initial realistic lesson plans
   */
  private async seedInitialLessonPlans() {
    const count = await this.lessonPlanRepository.count();
    if (count > 0) return;

    const teachers = await this.userRepository.find({
      where: { role: 'teacher' },
      take: 4,
    });
    if (teachers.length === 0) return;

    const classes = await this.classRepository.find({ take: 3 });
    const subjects = await this.subjectRepository.find({ take: 3 });
    const headmaster = await this.userRepository.findOne({
      where: { role: 'headmaster' },
    });

    const today = this.getLocalDateString();

    const samplePlans = [
      {
        teacher: teachers[0],
        class: classes[0] || null,
        subject: subjects[0] || null,
        date: today,
        title: 'Introduction to Calculus & Derivatives',
        topic: 'Limit Definition of Derivative and Tangent Slopes',
        objectives:
          '1. Understand rate of change.\n2. Calculate limits of difference quotients.\n3. Solve real-world velocity application problems.',
        isLate: false,
        status: 'reviewed' as const,
        reviewedBy: headmaster || null,
        reviewNotes: 'Excellent structured breakdown with clear student engagement activities. Approved.',
        reviewedAt: new Date(),
        fileName: 'Calculus_LessonPlan_Unit4.pdf',
        fileSize: 2450000,
        mimeType: 'application/pdf',
      },
      {
        teacher: teachers[1] || teachers[0],
        class: classes[1] || null,
        subject: subjects[1] || null,
        date: today,
        title: 'Modern Chemistry: Acid-Base Titration Laboratory',
        topic: 'Neutralization Reactions & Indicator Endpoints',
        objectives:
          '1. Set up burettes with standard NaOH solution.\n2. Record titration curves using phenolphthalein.\n3. Apply stoichiometry to find unknown molarity.',
        isLate: false,
        status: 'pending' as const,
        reviewedBy: null,
        reviewNotes: null,
        reviewedAt: null,
        fileName: 'Chemistry_Lab_Guide_Titration.docx',
        fileSize: 1820000,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      {
        teacher: teachers[2] || teachers[0],
        class: classes[2] || null,
        subject: subjects[2] || null,
        date: '2026-09-12',
        title: 'World Literature: The Odyssey and Epic Poetry',
        topic: 'Heroic Journey Archetypes in Classical Epic',
        objectives:
          '1. Analyze Homeric epithets.\n2. Map character traits of Odysseus.\n3. Small group comparative discussion.',
        isLate: true,
        justification: 'Campus network synchronization delay during morning shift transition.',
        status: 'needs_revision' as const,
        reviewedBy: headmaster || null,
        reviewNotes: 'Please add rubric criteria for the small group comparative discussion assessment.',
        reviewedAt: new Date(Date.now() - 3600000 * 24),
        fileName: 'WorldLit_Odyssey_Unit.pdf',
        fileSize: 3100000,
        mimeType: 'application/pdf',
      },
    ];

    for (const item of samplePlans) {
      const plan = this.lessonPlanRepository.create({
        teacherId: item.teacher.id,
        schoolId: item.teacher.schoolId,
        classId: item.class?.id || null,
        subjectId: item.subject?.id || null,
        date: item.date,
        title: item.title,
        topic: item.topic,
        objectives: item.objectives,
        isLate: item.isLate,
        justification: item.justification || null,
        status: item.status,
        reviewedById: item.reviewedBy?.id || null,
        reviewNotes: item.reviewNotes,
        reviewedAt: item.reviewedAt,
        fileName: item.fileName,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        fileUrl: item.fileName ? `/uploads/lesson-plans/${item.fileName}` : null,
      });
      await this.lessonPlanRepository.save(plan);
    }

    this.logger.log(`Seeded ${samplePlans.length} initial lesson plans.`);
  }
}
