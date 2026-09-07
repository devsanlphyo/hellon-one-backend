import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  principalName?: string;

  @IsUUID()
  @IsOptional()
  headmasterId?: string;
}
