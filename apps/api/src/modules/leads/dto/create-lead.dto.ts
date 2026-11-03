import { IsString, IsOptional, IsEmail, IsNumber } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  source?: string; // Website, Referral, LinkedIn, Cold Outreach, Other

  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsNumber()
  estimatedValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
