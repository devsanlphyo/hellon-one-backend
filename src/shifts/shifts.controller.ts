import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { AssignShiftDto } from './dto/assign-shift.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CheckInDto, CheckOutDto } from './dto/check-in-out.dto';
import { CreateShiftDefinitionDto } from './dto/create-shift-definition.dto';
import { UpdateShiftDefinitionDto } from './dto/update-shift-definition.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('headmaster', 'director', 'admin')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  async getShifts() {
    return this.shiftsService.getAllShifts();
  }

  @Post()
  @Roles('admin')
  async createShift(@Body() dto: CreateShiftDefinitionDto) {
    return this.shiftsService.createShift(dto);
  }

  @Patch(':id')
  @Roles('admin')
  async updateShift(
    @Param('id') id: string,
    @Body() dto: UpdateShiftDefinitionDto,
  ) {
    return this.shiftsService.updateShift(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async deleteShift(@Param('id') id: string) {
    return this.shiftsService.deleteShift(id);
  }

  @Get('teachers')
  async getTeachersWithShifts() {
    return this.shiftsService.getTeachersWithShifts();
  }

  @Post('assign')
  async assignTeacher(@Body() dto: AssignShiftDto, @Request() req) {
    const callerId = req.user?.id || req.user?.sub;
    return this.shiftsService.assignTeacher(dto, callerId);
  }

  @Patch('assign/:id')
  async updateAssignment(@Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return this.shiftsService.updateTeacherShift(id, dto);
  }

  @Delete('assign/:teacherId')
  async unassignTeacher(@Param('teacherId') teacherId: string) {
    return this.shiftsService.unassignTeacher(teacherId);
  }

  // ── STAFF ATTENDANCE ACTIONS (ALL ROLES) ──

  @Get('attendance/today')
  @Roles('teacher', 'assistant', 'officer', 'headmaster', 'director', 'admin')
  async getTodayStatus(@Request() req) {
    const userId = req.user?.id || req.user?.sub;
    return this.shiftsService.getMyTodayStatus(userId);
  }

  @Post('attendance/check-in')
  @Roles('teacher', 'assistant', 'officer', 'headmaster', 'director', 'admin')
  async checkIn(@Body() dto: CheckInDto, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    return this.shiftsService.checkIn(userId, dto?.notes);
  }

  @Post('attendance/check-out')
  @Roles('teacher', 'assistant', 'officer', 'headmaster', 'director', 'admin')
  async checkOut(@Body() dto: CheckOutDto, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    return this.shiftsService.checkOut(userId, dto?.notes);
  }

  // ── MONITORING & LEDGER (HEADMASTER, DIRECTOR, ADMIN) ──

  @Get('attendance/monitor')
  @Roles('headmaster', 'director', 'admin')
  async getAttendanceMonitor(
    @Query() query: AttendanceQueryDto,
    @Request() req,
  ) {
    return this.shiftsService.getAttendanceMonitorData(query, req.user);
  }

  @Get('attendance')
  async getAttendance(@Query('teacherId') teacherId?: string) {
    return this.shiftsService.getAttendanceRecords(teacherId);
  }
}
