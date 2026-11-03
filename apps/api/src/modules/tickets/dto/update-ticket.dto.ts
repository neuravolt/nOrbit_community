import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Priority } from '@prisma/client';

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  amcContractId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
