import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import { QueryLessonPlansDto } from './dto/query-lesson-plans.dto';
import { ReviewLessonPlanDto } from './dto/review-lesson-plan.dto';
import { LessonPlansService } from './lesson-plans.service';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB limit

const lessonPlanMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = join(process.cwd(), 'public', 'uploads', 'lesson-plans');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      const uniqueName = `plan-${uuidv4()}${ext}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (
    _req: any,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Invalid file type. Supported formats: PDF, Word (DOC/DOCX), PowerPoint (PPT/PPTX), Text, or Image.',
        ),
        false,
      );
    }
  },
};

@Controller('lesson-plans')
export class LessonPlansController {
  constructor(private readonly lessonPlansService: LessonPlansService) {}

  /**
   * Flowchart Evaluation:
   * Returns whether today is a leave day (IsLeaveDay?), duty day (IsDutyDay?),
   * along with existing submitted plans for the teacher.
   */
  @Get('daily-status')
  @UseGuards(JwtAuthGuard)
  async getDailyStatus(@Req() req: any, @Query('date') date?: string) {
    return this.lessonPlansService.getDailyStatus(req.user.id, date);
  }

  /**
   * Submit a new lesson plan with optional document attachment (up to 100MB)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('teacher', 'assistant', 'admin')
  @UseInterceptors(FileInterceptor('file', lessonPlanMulterOptions))
  async submitLessonPlan(
    @Req() req: any,
    @Body() dto: CreateLessonPlanDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.lessonPlansService.submitLessonPlan(req.user.id, dto, file);
  }

  /**
   * List lesson plans for current authenticated teacher
   */
  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyLessonPlans(
    @Req() req: any,
    @Query() query: QueryLessonPlansDto,
  ) {
    return this.lessonPlansService.getTeacherPlans(req.user.id, query);
  }

  /**
   * Headmaster view: List lesson plans & compliance summary for the school
   */
  @Get('school')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('headmaster', 'admin', 'director')
  async getSchoolLessonPlans(
    @Req() req: any,
    @Query() query: QueryLessonPlansDto,
  ) {
    const schoolId = query.schoolId || req.user.schoolId;
    if (!schoolId) {
      throw new BadRequestException('School ID is required');
    }
    return this.lessonPlansService.getCampusPlans(schoolId, query);
  }

  /**
   * Director view: Multi-campus institutional compliance & all plans
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('director', 'admin')
  async getAllLessonPlans(@Query() query: QueryLessonPlansDto) {
    return this.lessonPlansService.getAllPlans(query);
  }

  /**
   * Review a lesson plan (Headmaster or Director)
   */
  @Patch(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('headmaster', 'director', 'admin')
  async reviewLessonPlan(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ReviewLessonPlanDto,
  ) {
    return this.lessonPlansService.reviewLessonPlan(id, req.user.id, dto);
  }

  /**
   * Delete / cancel a pending lesson plan
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteLessonPlan(@Req() req: any, @Param('id') id: string) {
    return this.lessonPlansService.deleteLessonPlan(id, req.user.id);
  }
}
