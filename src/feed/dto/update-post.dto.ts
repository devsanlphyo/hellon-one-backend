import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePostDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsIn(['public', 'campus', 'private'])
  visibility?: 'public' | 'campus' | 'private';

  @IsOptional()
  @IsString()
  theme?: string;
}
