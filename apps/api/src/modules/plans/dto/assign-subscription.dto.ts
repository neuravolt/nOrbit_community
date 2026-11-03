import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
} from 'class-validator';

export class AssignSubscriptionDto {
  @IsString()
  @IsOptional()
  planId?: string;

  @IsString()
  @IsOptional()
  @IsIn(['ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED'])
  status?: string;

  @IsString()
  @IsOptional()
  @IsIn(['MONTHLY', 'YEARLY'])
  billingInterval?: string;

  @IsString()
  @IsOptional()
  @IsIn(['INR', 'USD'])
  currency?: string;

  @IsNumber()
  @IsOptional()
  customMaxMembers?: number | null;

  @IsNumber()
  @IsOptional()
  customMaxProjects?: number | null;

  @IsNumber()
  @IsOptional()
  customMaxServers?: number | null;

  @IsDateString()
  @IsOptional()
  expiresAt?: string | null;

  @IsDateString()
  @IsOptional()
  trialExpiresAt?: string | null;
}
