import { IsNumber, IsString, IsOptional } from 'class-validator';

export class LogAmcHoursDto {
  @IsNumber()
  hours: number;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  linkedTicketId?: string;

  @IsOptional()
  @IsString()
  linkedTaskId?: string;
}
