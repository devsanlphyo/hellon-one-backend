import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { AssignSchoolSubjectsDto } from './dto/assign-subjects.dto';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolsService } from './schools.service';

@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    return this.schoolsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.schoolsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.schoolsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/subjects')
  async getSchoolSubjects(@Param('id') id: string) {
    return this.schoolsService.getSchoolSubjects(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'headmaster')
  @Post(':id/subjects')
  async assignSchoolSubjects(
    @Param('id') id: string,
    @Body() dto: AssignSchoolSubjectsDto,
  ) {
    return this.schoolsService.assignSchoolSubjects(id, dto);
  }
}
