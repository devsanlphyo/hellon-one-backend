import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { ClassesService } from './classes.service';
import { AssignClassSubjectDto } from './dto/assign-class-subject.dto';
import { AssignSchoolDto } from './dto/assign-school.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { QueryClassDto } from './dto/query-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'headmaster')
  @Post()
  async create(@Body() dto: CreateClassDto) {
    return this.classesService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Query() query: QueryClassDto) {
    return this.classesService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.classesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'headmaster')
  @Patch(':id/school')
  async assignSchool(
    @Param('id') id: string,
    @Body() dto: AssignSchoolDto,
  ) {
    return this.classesService.assignSchool(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'headmaster')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.classesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/subjects')
  async getClassSubjects(@Param('id') id: string) {
    return this.classesService.getClassSubjects(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'headmaster')
  @Post(':id/subjects')
  async assignSubjectTeacher(
    @Param('id') id: string,
    @Body() dto: AssignClassSubjectDto,
  ) {
    return this.classesService.assignSubjectTeacher(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'headmaster')
  @Delete(':id/subjects/:subjectId')
  async removeClassSubject(
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.classesService.removeClassSubject(id, subjectId);
  }
}
