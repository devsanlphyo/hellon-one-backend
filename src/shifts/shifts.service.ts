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
import { AssignShiftDto } from './dto/assign-shift.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { Shift } from './entities/shift.entity';
import { TeacherAttendance } from './entities/teacher-attendance.entity';
import { TeacherShift } from './entities/teacher-shift.entity';

@Injectable()
export class ShiftsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(TeacherShift)
    private readonly teacherShiftRepository: Repository<TeacherShift>,
    @InjectRepository(TeacherAttendance)
    private readonly attendanceRepository: Repository<TeacherAttendance>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedStandardShifts();
    await this.seedInitialAssignmentsAndAttendance();
  }

  private async seedStandardShifts() {
    const defaultShifts = [
      {
        name: 'Morning Shift',
        code: 'morning',
        startTime: '09:00',
        endTime: '12:00',
        description: 'Morning core curriculum, lectures, and laboratory duty.',
        color: 'sky',
        isActive: true,
      },
      {
        name: 'Noon Shift',
        code: 'noon',
        startTime: '13:00',
        endTime: '17:00',
        description: 'Afternoon classes, academic mentoring, and campus supervision.',
        color: 'amber',
        isActive: true,
      },
      {
        name: 'Full-Time Shift',
        code: 'fulltime',
        startTime: '09:00',
        endTime: '17:00',
        description: 'Comprehensive all-day teaching, student counseling, and department duties.',
        color: 'indigo',
        isActive: true,
      },
    ];

    for (const shiftData of defaultShifts) {
      const existing = await this.shiftRepository.findOne({
        where: { code: shiftData.code },
      });
      if (!existing) {
        const shift = this.shiftRepository.create(shiftData);
        await this.shiftRepository.save(shift);
        this.logger.log(`Seeded shift: ${shift.name}`);
      }
    }
  }

  private async seedInitialAssignmentsAndAttendance() {
    const count = await this.teacherShiftRepository.count();
    if (count > 0) {
      return;
    }

    const teachers = await this.userRepository.find({
      where: { role: 'teacher' },
      order: { createdAt: 'ASC' },
      take: 6,
    });

    if (teachers.length === 0) {
      return;
    }

    const morningShift = await this.shiftRepository.findOne({ where: { code: 'morning' } });
    const noonShift = await this.shiftRepository.findOne({ where: { code: 'noon' } });
    const fulltimeShift = await this.shiftRepository.findOne({ where: { code: 'fulltime' } });

    if (!morningShift || !noonShift || !fulltimeShift) {
      return;
    }

    const shiftMap = [
      morningShift,
      noonShift,
      fulltimeShift,
      morningShift,
      noonShift,
      fulltimeShift,
    ];

    // Seed assignments
    for (let i = 0; i < teachers.length; i++) {
      const teacher = teachers[i];
      const assignedShift = shiftMap[i % shiftMap.length];

      const assignment = this.teacherShiftRepository.create({
        teacherId: teacher.id,
        shiftId: assignedShift.id,
        semester: 'Fall 2026 Semester',
        isPermanent: true,
        status: 'active',
        notes: `Assigned for full semester duty by Headmaster.`,
      });
      await this.teacherShiftRepository.save(assignment);
    }

    this.logger.log(`Seeded initial teacher shift assignments for ${teachers.length} teachers.`);

    // Seed realistic check-in / check-out records for these teachers
    const today = new Date().toISOString().split('T')[0];
    const sampleAttendances = [
      {
        teacher: teachers[0],
        shift: morningShift,
        date: today,
        checkInTime: '08:52 AM',
        checkOutTime: '12:05 PM',
        duration: '3h 13m',
        status: 'completed' as const,
        notes: 'Signed out on time after morning lab session.',
      },
      {
        teacher: teachers[1],
        shift: noonShift,
        date: today,
        checkInTime: '12:55 PM',
        checkOutTime: null,
        duration: 'In Progress',
        status: 'in_progress' as const,
        notes: 'Currently conducting afternoon tutorial.',
      },
      {
        teacher: teachers[2],
        shift: fulltimeShift,
        date: today,
        checkInTime: '09:14 AM',
        checkOutTime: null,
        duration: 'In Progress',
        status: 'late' as const,
        notes: 'Arrived 14 mins late due to campus transit delay.',
      },
      {
        teacher: teachers[3] || teachers[0],
        shift: morningShift,
        date: '2026-09-06',
        checkInTime: '08:48 AM',
        checkOutTime: '12:02 PM',
        duration: '3h 14m',
        status: 'completed' as const,
        notes: 'Punctual attendance.',
      },
      {
        teacher: teachers[4] || teachers[1],
        shift: noonShift,
        date: '2026-09-06',
        checkInTime: '13:00 PM',
        checkOutTime: '17:10 PM',
        duration: '4h 10m',
        status: 'completed' as const,
        notes: 'Completed semester office hours.',
      },
    ];

    for (const item of sampleAttendances) {
      const record = this.attendanceRepository.create({
        teacherId: item.teacher.id,
        shiftId: item.shift.id,
        date: item.date,
        checkInTime: item.checkInTime,
        checkOutTime: item.checkOutTime,
        duration: item.duration,
        status: item.status,
        notes: item.notes,
      });
      await this.attendanceRepository.save(record);
    }

    this.logger.log(`Seeded initial teacher attendance check-in/out records.`);
  }

  async getAllShifts() {
    const shifts = await this.shiftRepository.find({
      order: { startTime: 'ASC' },
    });

    // Attach active teacher count for each shift
    const shiftsWithCounts = await Promise.all(
      shifts.map(async (shift) => {
        const assignedCount = await this.teacherShiftRepository.count({
          where: { shiftId: shift.id, status: 'active' },
        });
        return {
          ...shift,
          assignedCount,
        };
      }),
    );

    return shiftsWithCounts;
  }

  async getTeachersWithShifts() {
    // Get all teachers
    const teachers = await this.userRepository.find({
      where: { role: 'teacher' },
      order: { fullName: 'ASC' },
    });

    const activeAssignments = await this.teacherShiftRepository.find({
      where: { status: 'active' },
      relations: { shift: true },
    });

    const assignmentMap = new Map<string, TeacherShift>();
    activeAssignments.forEach((assignment) => {
      assignmentMap.set(assignment.teacherId, assignment);
    });

    return teachers.map((teacher) => {
      const assignment = assignmentMap.get(teacher.id);
      return {
        id: teacher.id,
        fullName: teacher.fullName,
        email: teacher.email,
        status: teacher.status,
        avatarUrl: teacher.avatarUrl,
        assignment: assignment
          ? {
              id: assignment.id,
              shiftId: assignment.shiftId,
              shiftName: assignment.shift?.name,
              shiftCode: assignment.shift?.code,
              startTime: assignment.shift?.startTime,
              endTime: assignment.shift?.endTime,
              shiftColor: assignment.shift?.color,
              semester: assignment.semester,
              isPermanent: assignment.isPermanent,
              notes: assignment.notes,
              createdAt: assignment.createdAt,
            }
          : null,
      };
    });
  }

  async assignTeacher(dto: AssignShiftDto, assignedById?: string) {
    const teacher = await this.userRepository.findOne({
      where: { id: dto.teacherId },
    });
    if (!teacher) {
      throw new NotFoundException(`Teacher not found with ID ${dto.teacherId}`);
    }

    const shift = await this.shiftRepository.findOne({
      where: { id: dto.shiftId },
    });
    if (!shift) {
      throw new NotFoundException(`Shift not found with ID ${dto.shiftId}`);
    }

    let assignment = await this.teacherShiftRepository.findOne({
      where: { teacherId: dto.teacherId },
    });

    if (assignment) {
      assignment.shiftId = dto.shiftId;
      assignment.status = 'active';
      assignment.isPermanent = true;
      assignment.semester = dto.semester || assignment.semester || 'Fall 2026 Semester';
      assignment.notes = dto.notes !== undefined ? dto.notes : assignment.notes;
      if (assignedById) assignment.assignedById = assignedById;
      await this.teacherShiftRepository.save(assignment);
    } else {
      assignment = this.teacherShiftRepository.create({
        teacherId: dto.teacherId,
        shiftId: dto.shiftId,
        semester: dto.semester || 'Fall 2026 Semester',
        isPermanent: true,
        status: 'active',
        assignedById: assignedById || null,
        notes: dto.notes || 'Fixed semester assignment.',
      });
      await this.teacherShiftRepository.save(assignment);
    }

    // Return the updated assignment with shift info
    return this.teacherShiftRepository.findOne({
      where: { id: assignment.id },
      relations: { shift: true, teacher: true },
    });
  }

  async updateTeacherShift(id: string, dto: UpdateShiftDto) {
    const assignment = await this.teacherShiftRepository.findOne({
      where: { id },
      relations: { shift: true, teacher: true },
    });

    if (!assignment) {
      throw new NotFoundException(`Shift assignment not found`);
    }

    if (dto.shiftId) {
      const shift = await this.shiftRepository.findOne({
        where: { id: dto.shiftId },
      });
      if (!shift) {
        throw new NotFoundException(`Shift not found with ID ${dto.shiftId}`);
      }
      assignment.shiftId = dto.shiftId;
    }

    if (dto.semester) assignment.semester = dto.semester;
    if (dto.status) assignment.status = dto.status;
    if (dto.notes !== undefined) assignment.notes = dto.notes;

    await this.teacherShiftRepository.save(assignment);

    return this.teacherShiftRepository.findOne({
      where: { id: assignment.id },
      relations: { shift: true, teacher: true },
    });
  }

  async unassignTeacher(teacherId: string) {
    const assignment = await this.teacherShiftRepository.findOne({
      where: { teacherId },
    });

    if (!assignment) {
      throw new NotFoundException(`No assignment found for teacher ID ${teacherId}`);
    }

    await this.teacherShiftRepository.remove(assignment);
    return { success: true, message: 'Teacher successfully unassigned from shift' };
  }

  async getAttendanceRecords(teacherId?: string) {
    const qb = this.attendanceRepository
      .createQueryBuilder('att')
      .leftJoinAndSelect('att.teacher', 'teacher')
      .leftJoinAndSelect('att.shift', 'shift')
      .orderBy('att.date', 'DESC')
      .addOrderBy('att.createdAt', 'DESC');

    if (teacherId) {
      qb.andWhere('att.teacherId = :teacherId', { teacherId });
    }

    const records = await qb.getMany();
    return records.map((record) => ({
      id: record.id,
      teacherId: record.teacherId,
      teacherName: record.teacher ? record.teacher.fullName : 'Unknown Teacher',
      teacherEmail: record.teacher ? record.teacher.email : '',
      teacherAvatar: record.teacher ? record.teacher.avatarUrl : null,
      shiftId: record.shiftId,
      shiftName: record.shift ? record.shift.name : 'Unknown Shift',
      shiftStartTime: record.shift ? record.shift.startTime : '',
      shiftEndTime: record.shift ? record.shift.endTime : '',
      shiftColor: record.shift ? record.shift.color : 'blue',
      date: record.date,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      duration: record.duration,
      status: record.status,
      notes: record.notes,
    }));
  }

  // ── HELPER UTILITIES ──

  private getLocalDateString(d: Date = new Date()): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTime12h(d: Date = new Date()): string {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  private formatShiftHours(startTime?: string, endTime?: string): string {
    if (!startTime || !endTime) return '08:00 AM - 04:00 PM';
    const formatH = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      if (isNaN(h)) return t;
      const period = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')} ${period}`;
    };
    return `${formatH(startTime)} - ${formatH(endTime)}`;
  }

  private checkShiftWindow(shift: Shift): { isWithinShift: boolean; isLate: boolean } {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = shift.startTime.split(':').map(Number);
    const [endH, endM] = shift.endTime.split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    // Allow check-in starting 30 minutes before shift until shift end
    const isWithinShift =
      currentMinutes >= startMinutes - 30 && currentMinutes <= endMinutes;
    const isLate = currentMinutes > startMinutes + 10;
    return { isWithinShift, isLate };
  }

  // ── STAFF CHECK-IN / CHECK-OUT LOGIC ──

  async getMyTodayStatus(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { school: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const today = this.getLocalDateString();

    const attendance = await this.attendanceRepository.findOne({
      where: { teacherId: userId, date: today },
      relations: { shift: true },
      order: { createdAt: 'DESC' },
    });

    const assignment = await this.teacherShiftRepository.findOne({
      where: { teacherId: userId, status: 'active' },
      relations: { shift: true },
    });
    const assignedShift = assignment?.shift || null;

    let isWithinShift = true;
    if (user.role === 'teacher' && assignedShift) {
      const windowCheck = this.checkShiftWindow(assignedShift);
      isWithinShift = windowCheck.isWithinShift;
    }

    const isCheckedIn = Boolean(attendance);
    const isCheckedOut = Boolean(attendance?.checkOutTime);

    // canCheckIn: Not already checked in, and is within shift (or non-teacher)
    const canCheckIn = !isCheckedIn && (isWithinShift || user.role !== 'teacher');
    // canCheckOut: Checked in, but not yet checked out
    const canCheckOut = isCheckedIn && !isCheckedOut;

    return {
      date: today,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        schoolName: user.school?.name || 'Main Campus Office',
      },
      shift: assignedShift
        ? {
            id: assignedShift.id,
            name: assignedShift.name,
            code: assignedShift.code,
            startTime: assignedShift.startTime,
            endTime: assignedShift.endTime,
            formattedHours: this.formatShiftHours(
              assignedShift.startTime,
              assignedShift.endTime,
            ),
            color: assignedShift.color,
          }
        : null,
      isWithinShift,
      isCheckedIn,
      isCheckedOut,
      canCheckIn,
      canCheckOut,
      attendance: attendance
        ? {
            id: attendance.id,
            date: attendance.date,
            checkInTime: attendance.checkInTime,
            checkOutTime: attendance.checkOutTime,
            duration: attendance.duration,
            status: attendance.status,
            notes: attendance.notes,
            shiftName: attendance.shift?.name || assignedShift?.name || null,
          }
        : null,
    };
  }

  async checkIn(userId: string, notes?: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const today = this.getLocalDateString();

    // Check if already checked in today
    const existing = await this.attendanceRepository.findOne({
      where: { teacherId: userId, date: today },
    });
    if (existing) {
      throw new BadRequestException('You have already checked in for today.');
    }

    // Find assigned shift (if any)
    const assignment = await this.teacherShiftRepository.findOne({
      where: { teacherId: userId, status: 'active' },
      relations: { shift: true },
    });
    const assignedShift = assignment?.shift || null;

    let status: 'on_time' | 'late' | 'in_progress' = 'in_progress';

    // Verify shift window for teachers
    if (user.role === 'teacher' && assignedShift) {
      const windowCheck = this.checkShiftWindow(assignedShift);
      if (!windowCheck.isWithinShift) {
        throw new BadRequestException(
          `Check-in is currently unavailable. Your shift (${assignedShift.name}) runs from ${assignedShift.startTime} to ${assignedShift.endTime}.`,
        );
      }
      status = windowCheck.isLate ? 'late' : 'in_progress';
    }

    const checkInTime = this.formatTime12h();

    const record = this.attendanceRepository.create({
      teacherId: userId,
      shiftId: assignedShift?.id || null,
      date: today,
      checkInTime,
      checkOutTime: null,
      duration: 'In Progress',
      status,
      notes: notes || null,
    });

    await this.attendanceRepository.save(record);

    return this.getMyTodayStatus(userId);
  }

  async checkOut(userId: string, notes?: string) {
    const today = this.getLocalDateString();

    const record = await this.attendanceRepository.findOne({
      where: { teacherId: userId, date: today },
      order: { createdAt: 'DESC' },
    });

    if (!record) {
      throw new BadRequestException(
        'No active check-in record found for today. Please check in first.',
      );
    }
    if (record.checkOutTime) {
      throw new BadRequestException('You have already checked out for today.');
    }

    const now = new Date();
    record.checkOutTime = this.formatTime12h(now);

    // Calculate duration
    const diffMs = Math.max(0, now.getTime() - new Date(record.createdAt).getTime());
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    record.duration = `${hours}h ${mins.toString().padStart(2, '0')}m`;
    record.status = 'completed';

    if (notes) {
      record.notes = record.notes ? `${record.notes} | ${notes}` : notes;
    }

    await this.attendanceRepository.save(record);

    return this.getMyTodayStatus(userId);
  }

  // ── MONITOR ATTENDANCE FOR DIRECTOR & HEADMASTER ──

  async getAttendanceMonitorData(
    query: AttendanceQueryDto,
    caller: { id: string; role: string; schoolId?: string | null },
  ) {
    const targetDate = query.date || this.getLocalDateString();

    // Determine school filter scope
    let schoolId = query.schoolId;
    if (caller.role === 'headmaster') {
      schoolId = caller.schoolId || undefined;
    }

    // 1. Fetch eligible staff (teachers, assistants, officers)
    const staffQb = this.userRepository
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.school', 'school')
      .where('u.status = :status', { status: 'active' })
      .andWhere('u.role IN (:...roles)', {
        roles: ['teacher', 'assistant', 'officer'],
      });

    if (schoolId) {
      staffQb.andWhere('u.schoolId = :schoolId', { schoolId });
    }

    if (query.search) {
      staffQb.andWhere(
        '(LOWER(u.fullName) LIKE :search OR LOWER(u.email) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    const staffList = await staffQb.orderBy('u.fullName', 'ASC').getMany();

    // 2. Fetch attendances for targetDate
    const attendances = await this.attendanceRepository
      .createQueryBuilder('att')
      .leftJoinAndSelect('att.shift', 'shift')
      .where('att.date = :targetDate', { targetDate })
      .getMany();

    const attendanceMap = new Map<string, TeacherAttendance>();
    attendances.forEach((att) => {
      attendanceMap.set(att.teacherId, att);
    });

    // 3. Fetch active shifts
    const assignments = await this.teacherShiftRepository.find({
      where: { status: 'active' },
      relations: { shift: true },
    });
    const assignmentMap = new Map<string, Shift>();
    assignments.forEach((as) => {
      if (as.shift) assignmentMap.set(as.teacherId, as.shift);
    });

    // 4. Map staff rows
    const allRecords = staffList.map((staff, idx) => {
      const att = attendanceMap.get(staff.id);
      const shift = assignmentMap.get(staff.id);

      let monitorStatus:
        | 'checked_out'
        | 'checked_in'
        | 'late'
        | 'not_checked_in' = 'not_checked_in';

      if (att?.checkOutTime) {
        monitorStatus = 'checked_out';
      } else if (att?.checkInTime) {
        monitorStatus = att.status === 'late' ? 'late' : 'checked_in';
      }

      const shiftHours = shift
        ? this.formatShiftHours(shift.startTime, shift.endTime)
        : '08:00 AM - 04:00 PM';

      return {
        rowNumber: idx + 1,
        id: att?.id || `pending-${staff.id}`,
        teacherId: staff.id,
        teacherName: staff.fullName,
        teacherEmail: staff.email,
        teacherAvatar: staff.avatarUrl,
        teacherRole: staff.role,
        schoolName: staff.school?.name || 'Main Campus',
        schoolId: staff.schoolId,
        shiftName: shift?.name || 'General Duty',
        shiftTime: shiftHours,
        shiftColor: shift?.color || 'blue',
        status: monitorStatus,
        checkInTime: att?.checkInTime || null,
        checkOutTime: att?.checkOutTime || null,
        duration: att?.duration || null,
        notes: att?.notes || null,
      };
    });

    // 5. Calculate KPI counts
    const alreadyCheckedCount = allRecords.filter(
      (r) => r.status !== 'not_checked_in',
    ).length;
    const notCheckedCount = allRecords.filter(
      (r) => r.status === 'not_checked_in',
    ).length;

    // 6. Filter by status if requested
    let filteredRecords = allRecords;
    if (query.status && query.status !== 'all') {
      if (query.status === 'checked_in') {
        filteredRecords = allRecords.filter(
          (r) => r.status === 'checked_in' || r.status === 'late',
        );
      } else if (query.status === 'checked_out') {
        filteredRecords = allRecords.filter((r) => r.status === 'checked_out');
      } else if (query.status === 'not_checked_in') {
        filteredRecords = allRecords.filter((r) => r.status === 'not_checked_in');
      }
    }

    return {
      date: targetDate,
      summary: {
        alreadyCheckedCount,
        notCheckedCount,
        totalCount: allRecords.length,
      },
      records: filteredRecords,
    };
  }
}

