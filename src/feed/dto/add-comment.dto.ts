import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
