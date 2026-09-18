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
import { LeaveRequest } from '../leaves/entities/leave-request.entity';
import { AssignShiftDto } from './dto/assign-shift.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CreateShiftDefinitionDto } from './dto/create-shift-definition.dto';
import { SaveStaffScheduleDto } from './dto/save-staff-schedule.dto';
import { SaveTeacherScheduleDto } from './dto/save-teacher-schedule.dto';
import { SetCalendarDayDto } from './dto/set-calendar-day.dto';
import { UpdateShiftDefinitionDto } from './dto/update-shift-definition.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CalendarDay } from './entities/calendar-day.entity';
import { Shift } from './entities/shift.entity';
import { StaffSchedule } from './entities/staff-schedule.entity';
import { TeacherAttendance } from './entities/teacher-attendance.entity';
import { TeacherShift } from './entities/teacher-shift.entity';

@Injectable()
export class ShiftsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(StaffSchedule)
    private readonly staffScheduleRepository: Repository<StaffSchedule>,
    @InjectRepository(CalendarDay)
    private readonly calendarDayRepository: Repository<CalendarDay>,
    @InjectRepository(TeacherShift)
    private readonly teacherShiftRepository: Repository<TeacherShift>,
    @InjectRepository(TeacherAttendance)
    private readonly attendanceRepository: Repository<TeacherAttendance>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRepository: Repository<LeaveRequest>,
  ) {}

  async onApplicationBootstrap() {
    // Auto-seeding disabled to keep database clean
  }

  // ── SHIFT DEFINITIONS CRUD ──

  async getAllShifts() {
    const shifts = await this.shiftRepository.find({
      order: { startTime: 'ASC' },
    });

    // Attach active teacher count for each shift (from staff_schedules and legacy teacher_shifts)
    const shiftsWithCounts = await Promise.all(
      shifts.map(async (shift) => {
        const assignedInSchedules = await this.staffScheduleRepository
          .createQueryBuilder('ss')
          .select('COUNT(DISTINCT ss.userId)', 'cnt')
          .where('ss.shiftId = :shiftId', { shiftId: shift.id })
          .getRawOne();

        const assignedLegacy = await this.teacherShiftRepository.count({
          where: { shiftId: shift.id, status: 'active' },
        });

        const totalAssigned = Math.max(
          parseInt(assignedInSchedules?.cnt || '0', 10),
          assignedLegacy,
        );

        return {
          ...shift,
          assignedCount: totalAssigned,
        };
      }),
    );

    return shiftsWithCounts;
  }

  async createShift(dto: CreateShiftDefinitionDto) {
    const existing = await this.shiftRepository.findOne({
      where: [{ code: dto.code }, { name: dto.name }],
    });

    if (existing) {
      throw new BadRequestException('A shift with this name or code already exists');
    }

    const shift = this.shiftRepository.create({
      name: dto.name,
      code: dto.code.toLowerCase().trim().replace(/\s+/g, '-'),
      startTime: dto.startTime,
      endTime: dto.endTime,
      description: dto.description || '',
      color: dto.color || 'sky',
      graceMinutes: dto.graceMinutes !== undefined ? Number(dto.graceMinutes) : 15,
      isActive: true,
    });

    return this.shiftRepository.save(shift);
  }

  async updateShift(id: string, dto: UpdateShiftDefinitionDto) {
    const shift = await this.shiftRepository.findOne({ where: { id } });
    if (!shift) {
      throw new NotFoundException(`Shift not found with ID ${id}`);
    }

    if (dto.name && dto.name !== shift.name) {
      const existingName = await this.shiftRepository.findOne({
        where: { name: dto.name },
      });
      if (existingName && existingName.id !== id) {
        throw new BadRequestException('Another shift already uses this name');
      }
      shift.name = dto.name;
    }

    if (dto.startTime !== undefined) shift.startTime = dto.startTime;
    if (dto.endTime !== undefined) shift.endTime = dto.endTime;
    if (dto.description !== undefined) shift.description = dto.description;
    if (dto.color !== undefined) shift.color = dto.color;
    if (dto.graceMinutes !== undefined) shift.graceMinutes = Number(dto.graceMinutes);
    if (dto.isActive !== undefined) shift.isActive = dto.isActive;

    return this.shiftRepository.save(shift);
  }

  async deleteShift(id: string) {
    const shift = await this.shiftRepository.findOne({ where: { id } });
    if (!shift) {
      throw new NotFoundException(`Shift not found with ID ${id}`);
    }

    const assignedCount = await this.staffScheduleRepository.count({
      where: { shiftId: id },
    });

    if (assignedCount > 0) {
      throw new BadRequestException(
        `Cannot delete shift "${shift.name}" because ${assignedCount} faculty schedule assignment(s) are linked to it. Please reassign them first.`,
      );
    }

    await this.shiftRepository.remove(shift);
    return { success: true, message: `Shift "${shift.name}" successfully deleted` };
  }

  // ── SCHOOL CALENDAR DAY MANAGEMENT ──

  async getAllCalendarDays() {
    return this.calendarDayRepository.find({
      order: { date: 'ASC' },
    });
  }

  async getCalendarDayStatus(date: string) {
    const existing = await this.calendarDayRepository.findOne({
      where: { date },
    });
    if (existing) {
      return {
        date: existing.date,
        isSchoolDay: existing.isSchoolDay,
        reason: existing.reason,
        isCustom: true,
      };
    }
    const dayOfWeek = this.getDayOfWeekNumber(date);
    const isStandardWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    return {
      date,
      isSchoolDay: isStandardWeekday,
      reason: isStandardWeekday ? null : 'Weekend Off-Day',
      isCustom: false,
    };
  }

  async setCalendarDay(dto: SetCalendarDayDto) {
    let day = await this.calendarDayRepository.findOne({
      where: { date: dto.date },
    });
    if (day) {
      day.isSchoolDay = dto.isSchoolDay;
      day.reason = dto.reason || null;
    } else {
      day = this.calendarDayRepository.create({
        date: dto.date,
        isSchoolDay: dto.isSchoolDay,
        reason: dto.reason || null,
      });
    }
    return this.calendarDayRepository.save(day);
  }

  async deleteCalendarDay(date: string) {
    const day = await this.calendarDayRepository.findOne({
      where: { date },
    });
    if (!day) {
      throw new NotFoundException(`No custom calendar override found for date ${date}`);
    }
    await this.calendarDayRepository.remove(day);
    return { success: true, message: `Override removed for date ${date}` };
  }

  // ── TEACHER WEEKLY SHIFT MATRIX (7-DAY) ──

  async getTeacherScheduleMatrix() {
    const teachers = await this.userRepository.find({
      where: { role: 'teacher' },
      relations: { school: true },
      order: { fullName: 'ASC' },
    });

    const teacherIds = teachers.map((t) => t.id);
    const schedules = teacherIds.length
      ? await this.staffScheduleRepository.find({
          where: teacherIds.map((id) => ({ userId: id })),
          relations: { shift: true },
        })
      : [];

    const scheduleMap = new Map<
      string,
      Record<
        number,
        {
          shiftId: string;
          shiftName: string;
          startTime: string;
          endTime: string;
          color: string;
        } | null
      >
    >();

    schedules.forEach((s) => {
      if (!scheduleMap.has(s.userId)) {
        scheduleMap.set(s.userId, {});
      }
      const userSched = scheduleMap.get(s.userId)!;
      userSched[s.dayOfWeek] = s.shift
        ? {
            shiftId: s.shift.id,
            shiftName: s.shift.name,
            startTime: s.shift.startTime,
            endTime: s.shift.endTime,
            color: s.shift.color,
          }
        : null;
    });

    return teachers.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      email: t.email,
      status: t.status,
      school: t.school
        ? { id: t.school.id, name: t.school.name, code: t.school.code }
        : null,
      schedules: scheduleMap.get(t.id) || {},
    }));
  }

  async saveTeacherScheduleMatrix(dto: SaveTeacherScheduleDto) {
    const teacher = await this.userRepository.findOne({
      where: { id: dto.userId },
    });
    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${dto.userId} not found`);
    }

    // Remove existing schedules for this teacher
    await this.staffScheduleRepository.delete({ userId: dto.userId });

    const newEntries: StaffSchedule[] = [];
    for (const item of dto.schedules || []) {
      if (item.shiftId) {
        const entry = this.staffScheduleRepository.create({
          userId: dto.userId,
          dayOfWeek: Number(item.dayOfWeek),
          shiftId: item.shiftId,
        });
        newEntries.push(entry);
      }
    }

    if (newEntries.length > 0) {
      await this.staffScheduleRepository.save(newEntries);
    }

    return {
      success: true,
      message: `Weekly schedule updated for teacher ${teacher.fullName}`,
    };
  }

  // ── STAFF WORKING DAYS (ASSISTANTS & OFFICERS) ──

  async getStaffScheduleList() {
    const staffMembers = await this.userRepository
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.school', 'school')
      .where('u.role IN (:...roles)', { roles: ['assistant', 'officer'] })
      .orderBy('u.fullName', 'ASC')
      .getMany();

    const staffIds = staffMembers.map((s) => s.id);
    const schedules = staffIds.length
      ? await this.staffScheduleRepository.find({
          where: staffIds.map((id) => ({ userId: id })),
        })
      : [];

    const scheduleMap = new Map<string, number[]>();
    schedules.forEach((s) => {
      if (!scheduleMap.has(s.userId)) {
        scheduleMap.set(s.userId, []);
      }
      scheduleMap.get(s.userId)!.push(s.dayOfWeek);
    });

    return staffMembers.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      role: s.role,
      status: s.status,
      school: s.school
        ? { id: s.school.id, name: s.school.name, code: s.school.code }
        : null,
      daysOfWeek: scheduleMap.get(s.id) || [],
    }));
  }

  async saveStaffSchedule(dto: SaveStaffScheduleDto) {
    const staff = await this.userRepository.findOne({
      where: { id: dto.userId },
    });
    if (!staff) {
      throw new NotFoundException(`Staff with ID ${dto.userId} not found`);
    }

    // Remove existing schedules
    await this.staffScheduleRepository.delete({ userId: dto.userId });

    const newEntries = (dto.daysOfWeek || []).map((day) =>
      this.staffScheduleRepository.create({
        userId: dto.userId,
        dayOfWeek: Number(day),
        shiftId: null,
      }),
    );

    if (newEntries.length > 0) {
      await this.staffScheduleRepository.save(newEntries);
    }

    return {
      success: true,
      message: `Assigned working days updated for ${staff.fullName}`,
    };
  }

  // ── LEGACY TEACHER SHIFTS (COMPATIBILITY) ──

  async getTeachersWithShifts() {
    const teachers = await this.userRepository.find({
      where: { role: 'teacher' },
      relations: { school: true },
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
        school: teacher.school
          ? {
              id: teacher.school.id,
              name: teacher.school.name,
              code: teacher.school.code,
            }
          : null,
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
      assignment.semester =
        dto.semester || assignment.semester || 'Fall 2026 Semester';
      assignment.notes =
        dto.notes !== undefined ? dto.notes : assignment.notes;
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
      throw new NotFoundException(
        `No assignment found for teacher ID ${teacherId}`,
      );
    }

    await this.teacherShiftRepository.remove(assignment);
    return {
      success: true,
      message: 'Teacher successfully unassigned from shift',
    };
  }

  async getAttendanceRecords(staffId?: string) {
    const qb = this.attendanceRepository
      .createQueryBuilder('att')
      .leftJoinAndSelect('att.staff', 'staff')
      .orderBy('att.date', 'DESC')
      .addOrderBy('att.createdAt', 'DESC');

    if (staffId) {
      qb.andWhere('att.staffId = :staffId', { staffId });
    }

    const records = await qb.getMany();

    return records.map((record) => ({
      id: record.id,
      staffId: record.staffId,
      staffName: record.staff ? record.staff.fullName : 'Unknown Staff',
      staffEmail: record.staff ? record.staff.email : '',
      staffAvatar: record.staff ? record.staff.avatarUrl : null,
      date: record.date,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      duration: record.duration,
      status: record.status,
      notes: record.notes,
    }));
  }

  // ── HELPER UTILITIES ──

  private getDayOfWeekNumber(dateStr: string): number {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    return day === 0 ? 7 : day; // 1 = Monday, ..., 7 = Sunday
  }

  private timeToMinutes(t: string): number {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

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

  private checkShiftWindow(
    shift: Shift,
  ): { isWithinShift: boolean; isLate: boolean } {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = shift.startTime.split(':').map(Number);
    const [endH, endM] = shift.endTime.split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    const isWithinShift =
      currentMinutes >= startMinutes - 30 && currentMinutes <= endMinutes;
    const isLate = currentMinutes > startMinutes + (shift.graceMinutes || 15);
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
    const dayOfWeek = this.getDayOfWeekNumber(today);

    // 1. Check School Calendar Day
    const calendarStatus = await this.getCalendarDayStatus(today);
    const isSchoolDay = calendarStatus.isSchoolDay;
    const calendarReason = calendarStatus.reason;

    // 2. Check Staff Schedule for Today
    const schedule = await this.staffScheduleRepository.findOne({
      where: { userId, dayOfWeek },
      relations: { shift: true },
    });

    let isScheduledToday = false;
    let assignedShift: Shift | null = null;

    if (user.role === 'teacher') {
      if (schedule && schedule.shift) {
        isScheduledToday = true;
        assignedShift = schedule.shift;
      } else {
        isScheduledToday = false;
      }
    } else if (user.role === 'assistant' || user.role === 'officer') {
      if (schedule) {
        isScheduledToday = true;
        assignedShift = schedule.shift || null;
      } else {
        isScheduledToday = false;
      }
    } else {
      // Admin, Director, Headmaster scheduled on all school days
      isScheduledToday = true;
    }

    const attendance = await this.attendanceRepository.findOne({
      where: { staffId: userId, date: today },
      order: { createdAt: 'DESC' },
    });

    let isWithinShift = true;
    if (assignedShift) {
      const windowCheck = this.checkShiftWindow(assignedShift);
      isWithinShift = windowCheck.isWithinShift;
    }

    const isCheckedIn = Boolean(attendance);
    const isCheckedOut = Boolean(attendance?.checkOutTime);

    // canCheckIn: Not already checked in, must be school open day, must be scheduled today
    const canCheckIn = !isCheckedIn && isSchoolDay && isScheduledToday;
    const canCheckOut = isCheckedIn && !isCheckedOut;

    return {
      date: today,
      dayOfWeek,
      isSchoolDay,
      calendarReason,
      isScheduledToday,
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
            graceMinutes: assignedShift.graceMinutes || 15,
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
            createdAt: attendance.createdAt,
            updatedAt: attendance.updatedAt,
            duration: attendance.duration,
            status: attendance.status,
            notes: attendance.notes,
            shiftName: assignedShift?.name || null,
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
    const dayOfWeek = this.getDayOfWeekNumber(today);
    const dayNames = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];

    // 1. Enforce Calendar Day Status
    const calendarStatus = await this.getCalendarDayStatus(today);
    if (!calendarStatus.isSchoolDay) {
      throw new BadRequestException(
        `School is closed on this day (${calendarStatus.reason || 'School Off-Day'}). Check-in is not permitted.`,
      );
    }

    // 2. Enforce Working Schedule
    const schedule = await this.staffScheduleRepository.findOne({
      where: { userId, dayOfWeek },
      relations: { shift: true },
    });

    let assignedShift: Shift | null = null;

    if (user.role === 'teacher') {
      if (!schedule || !schedule.shift) {
        throw new BadRequestException(
          `You are not assigned to a shift on ${dayNames[dayOfWeek - 1]} and cannot check in.`,
        );
      }
      assignedShift = schedule.shift;
    } else if (user.role === 'assistant' || user.role === 'officer') {
      if (!schedule) {
        throw new BadRequestException(
          `You are not scheduled to work on ${dayNames[dayOfWeek - 1]} and cannot check in.`,
        );
      }
      assignedShift = schedule.shift || null;
    }

    // 3. Check if already checked in today
    const existing = await this.attendanceRepository.findOne({
      where: { staffId: userId, date: today },
    });
    if (existing) {
      throw new BadRequestException('You have already checked in for today.');
    }

    // 4. Calculate Punctuality with graceMinutes
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    let status: 'on_time' | 'late' | 'in_progress' = 'in_progress';

    if (assignedShift) {
      const shiftStartMin = this.timeToMinutes(assignedShift.startTime);
      const limitMin = shiftStartMin + (assignedShift.graceMinutes || 15);
      status = currentMin > limitMin ? 'late' : 'in_progress';
    } else {
      const defaultStartMin = this.timeToMinutes('08:00');
      const limitMin = defaultStartMin + 15;
      status = currentMin > limitMin ? 'late' : 'in_progress';
    }

    const checkInTime = this.formatTime12h(now);

    const record = this.attendanceRepository.create({
      staffId: userId,
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
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const today = this.getLocalDateString();
    const dayOfWeek = this.getDayOfWeekNumber(today);
    const dayNames = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];

    // 1. Enforce Calendar Day Status
    const calendarStatus = await this.getCalendarDayStatus(today);
    if (!calendarStatus.isSchoolDay) {
      throw new BadRequestException(
        `School is closed on this day (${calendarStatus.reason || 'School Off-Day'}). Check-out is not permitted.`,
      );
    }

    // 2. Enforce Working Schedule
    const schedule = await this.staffScheduleRepository.findOne({
      where: { userId, dayOfWeek },
      relations: { shift: true },
    });

    if (user.role === 'teacher') {
      if (!schedule || !schedule.shift) {
        const legacyAssignment = await this.teacherShiftRepository.findOne({
          where: { teacherId: userId, status: 'active' },
          relations: { shift: true },
        });
        const anyMatrix = await this.staffScheduleRepository.count({
          where: { userId },
        });
        if (anyMatrix !== 0 || !legacyAssignment || !legacyAssignment.shift) {
          throw new BadRequestException(
            `You are not assigned to a shift on ${dayNames[dayOfWeek - 1]} and cannot check out.`,
          );
        }
      }
    } else if (user.role === 'assistant' || user.role === 'officer') {
      if (!schedule) {
        const anyMatrix = await this.staffScheduleRepository.count({
          where: { userId },
        });
        if (anyMatrix !== 0 || dayOfWeek > 5) {
          throw new BadRequestException(
            `You are not scheduled to work on ${dayNames[dayOfWeek - 1]} and cannot check out.`,
          );
        }
      }
    }

    const record = await this.attendanceRepository.findOne({
      where: { staffId: userId, date: today },
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
    const diffMs = Math.max(
      0,
      now.getTime() - new Date(record.createdAt).getTime(),
    );
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    record.duration = `${hours}h ${mins.toString().padStart(2, '0')}m`;
    record.status = record.status === 'late' ? 'late' : 'completed';

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
    const dayOfWeek = this.getDayOfWeekNumber(targetDate);

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
      .where('att.date = :targetDate', { targetDate })
      .getMany();

    const attendanceMap = new Map<string, TeacherAttendance>();
    attendances.forEach((att) => {
      attendanceMap.set(att.staffId, att);
    });

    // 3. Fetch matrix schedules for targetDate day of week
    const schedules = await this.staffScheduleRepository.find({
      where: { dayOfWeek },
      relations: { shift: true },
    });
    const scheduleMap = new Map<string, Shift | null>();
    schedules.forEach((s) => {
      scheduleMap.set(s.userId, s.shift || null);
    });

    // 3b. Fetch approved leaves for targetDate
    const approvedLeaves = await this.leaveRepository
      .createQueryBuilder('leave')
      .where('leave.status = :approved', { approved: 'approved' })
      .andWhere('leave.startDate <= :targetDate', { targetDate })
      .andWhere('leave.endDate >= :targetDate', { targetDate })
      .getMany();

    const leaveMap = new Map<string, LeaveRequest>();
    approvedLeaves.forEach((l) => leaveMap.set(l.userId, l));

    // 4. Map staff rows
    const allRecords = staffList.map((staff, idx) => {
      const att = attendanceMap.get(staff.id);
      const shift = scheduleMap.get(staff.id);
      const leave = leaveMap.get(staff.id);

      let monitorStatus:
        | 'checked_out'
        | 'checked_in'
        | 'late'
        | 'not_checked_in'
        | 'on_leave' = 'not_checked_in';

      if (leave) {
        monitorStatus = 'on_leave';
      } else if (att?.checkOutTime) {
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
        shiftName: shift?.name || 'Standard Duty',
        shiftTime: shiftHours,
        shiftColor: shift?.color || 'blue',
        status: monitorStatus,
        checkInTime: att?.checkInTime || null,
        checkOutTime: att?.checkOutTime || null,
        createdAt: att?.createdAt || null,
        updatedAt: att?.updatedAt || null,
        duration: att?.duration || null,
        notes: leave
          ? `On Approved Leave: ${leave.reason}`
          : att?.notes || null,
      };
    });

    // 5. Calculate KPI counts
    const alreadyCheckedCount = allRecords.filter(
      (r) =>
        r.status === 'checked_in' ||
        r.status === 'checked_out' ||
        r.status === 'late',
    ).length;
    const onLeaveCount = allRecords.filter(
      (r) => r.status === 'on_leave',
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
        filteredRecords = allRecords.filter(
          (r) => r.status === 'not_checked_in',
        );
      } else if (query.status === 'on_leave') {
        filteredRecords = allRecords.filter((r) => r.status === 'on_leave');
      }
    }

    return {
      date: targetDate,
      summary: {
        alreadyCheckedCount,
        notCheckedCount,
        onLeaveCount,
        totalCount: allRecords.length,
      },
      records: filteredRecords,
    };
  }
}
