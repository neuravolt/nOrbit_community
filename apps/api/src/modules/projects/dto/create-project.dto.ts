import { IsString, IsOptional, IsDateString, IsNumber } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsString()
  clientId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @IsOptional()
  @IsNumber()
  budget?: number;
}
