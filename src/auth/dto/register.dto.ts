import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { UserRole, UserStatus } from '../entities/user.entity';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsEnum(['admin', 'director', 'headmaster', 'officer', 'teacher', 'assistant'], {
    message: 'Invalid user role',
  })
  role: UserRole;

  @IsOptional()
  @IsEnum(['active', 'suspend'], { message: 'Invalid user status' })
  status?: UserStatus;

  @IsOptional()
  @IsString()
  schoolId?: string | null;
}
