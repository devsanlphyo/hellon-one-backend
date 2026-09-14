import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsIn(['public', 'campus', 'private'])
  visibility?: 'public' | 'campus' | 'private' = 'campus';

  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isAnnouncement?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPinned?: boolean = false;
}
