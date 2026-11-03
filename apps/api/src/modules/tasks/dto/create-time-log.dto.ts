import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateTimeLogDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  hours: number;

  @IsDateString()
  logDate: Date;
}
