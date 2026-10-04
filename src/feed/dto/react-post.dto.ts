import { IsOptional, IsString } from 'class-validator';

export class ReactPostDto {
  @IsOptional()
  @IsString()
  type?: string;
}
