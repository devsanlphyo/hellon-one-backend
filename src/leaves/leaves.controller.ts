import {
  Body,
  Controller,
  ForbiddenException,
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
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { QueryLeavesDto } from './dto/query-leaves.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { LeaveStatus } from './entities/leave-request.entity';
import { LeavesService } from './leaves.service';

@Controller('leaves')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  // ── 1. STAFF PORTAL: SUBMIT LEAVE REQUEST ──
  @Post()
  @Roles('teacher', 'assistant', 'officer', 'headmaster', 'director', 'admin')
  async submitLeaveRequest(@Body() dto: CreateLeaveRequestDto, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    return this.leavesService.createLeaveRequest(userId, dto);
  }

  // ── 2. STAFF PORTAL: VIEW CALLER'S OWN LEAVE REQUESTS ──
  @Get('my')
  @Roles('teacher', 'assistant', 'officer', 'headmaster', 'director', 'admin')
  async getMyLeaveRequests(@Request() req) {
    const userId = req.user?.id || req.user?.sub;
    return this.leavesService.getMyLeaveRequests(userId);
  }

  @Get('mine')
  @Roles('teacher', 'assistant', 'officer', 'headmaster', 'director', 'admin')
  async getMineLeaveRequests(@Request() req) {
    const userId = req.user?.id || req.user?.sub;
    return this.leavesService.getMyLeaveRequests(userId);
  }

  // ── 3. KPI STATS (HEADMASTER, DIRECTOR, ADMIN) ──
  @Get('stats')
  @Roles('headmaster', 'director', 'admin')
  async getStats(@Query('schoolId') schoolId: string, @Request() req) {
    const user = req.user;
    const targetSchoolId =
      user.role === 'headmaster' ? user.schoolId : schoolId || undefined;
    return this.leavesService.getLeaveStats(targetSchoolId);
  }

  // ── 4. HEADMASTER / CAMPUS PORTAL: VIEW SCHOOL LEAVE REQUESTS ──
  @Get('school')
  @Roles('headmaster', 'director', 'admin')
  async getSchoolLeaveRequests(
    @Query('status') status: 'pending' | 'approved' | 'rejected',
    @Query('schoolId') schoolId: string,
    @Request() req,
  ) {
    const user = req.user;
    const targetSchoolId =
      user.role === 'headmaster' ? user.schoolId : schoolId || user.schoolId;

    if (!targetSchoolId) {
      return [];
    }

    return this.leavesService.getSchoolLeaveRequests(targetSchoolId, status);
  }

  // ── 5. DIRECTOR / ADMIN: CROSS-CAMPUS LEAVE REQUESTS ──
  @Get()
  @Roles('director', 'admin')
  async getAllLeaves(@Query() query: QueryLeavesDto) {
    return this.leavesService.getAllLeaveRequests(query);
  }

  // ── 6. GET SINGLE LEAVE BY ID ──
  @Get(':id')
  @Roles('teacher', 'assistant', 'officer', 'headmaster', 'director', 'admin')
  async getLeaveById(@Param('id') id: string) {
    return this.leavesService.getLeaveById(id);
  }

  // ── 7. HEADMASTER / DIRECTOR: APPROVE OR REJECT LEAVE REQUEST ──
  @Patch(':id/status')
  @Roles('headmaster', 'director', 'admin')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveStatusDto,
    @Request() req,
  ) {
    const reviewerId = req.user?.id || req.user?.sub;
    const user = req.user;

    // If headmaster, verify request belongs to their school
    if (user.role === 'headmaster') {
      const leave = await this.leavesService.getLeaveById(id);
      if (leave.schoolId && user.schoolId && leave.schoolId !== user.schoolId) {
        throw new ForbiddenException(
          'You can only review leave requests for your assigned campus',
        );
      }
    }

    return this.leavesService.updateLeaveStatus(id, reviewerId, dto);
  }
}
