import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { UserRole, UserStatus } from '../../auth/entities/user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @IsOptional()
  @IsEnum(['admin', 'director', 'headmaster', 'officer', 'teacher', 'assistant'], {
    message: 'Invalid user role',
  })
  role?: UserRole;

  @IsOptional()
  @IsEnum(['active', 'suspend'], { message: 'Invalid user status' })
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string | null;
  @IsOptional()
  @IsString()
  schoolId?: string | null;
}
