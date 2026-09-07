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
  Request,
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
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const avatarMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = join(process.cwd(), 'public', 'uploads', 'avatars');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      const uniqueName = `avatar-${uuidv4()}${ext}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          `Unsupported file type "${file.mimetype}". Allowed: JPEG, PNG, WEBP.`,
        ),
        false,
      );
    }
  },
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    const userId = req.user.id || req.user.sub;
    return this.usersService.getProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/devices')
  async getMyDevices(@Request() req) {
    const userId = req.user.id || req.user.sub;
    return this.usersService.getMyDevices(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarMulterOptions))
  async uploadMyAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Field name must be "avatar".',
      );
    }
    const userId = req.user.id || req.user.sub;
    const protocol = req.protocol;
    const host = req.get('host');
    const avatarUrl = `${protocol}://${host}/uploads/avatars/${file.filename}`;
    return this.usersService.updateAvatar(userId, avatarUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/avatar')
  async removeMyAvatar(@Request() req) {
    const userId = req.user.id || req.user.sub;
    return this.usersService.updateAvatar(userId, null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  async findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarMulterOptions))
  async uploadUserAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Field name must be "avatar".',
      );
    }
    const protocol = req.protocol;
    const host = req.get('host');
    const avatarUrl = `${protocol}://${host}/uploads/avatars/${file.filename}`;
    return this.usersService.updateAvatar(id, avatarUrl);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id/avatar')
  async removeUserAvatar(@Param('id') id: string) {
    return this.usersService.updateAvatar(id, null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
