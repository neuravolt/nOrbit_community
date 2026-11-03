import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsUUID,
  IsIn,
  IsArray,
} from 'class-validator';

export class UpdateAmcContractDto {
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @IsOptional()
  @IsUUID(4, { message: 'Client ID must be a valid UUID' })
  clientId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @IsOptional()
  @IsNumber()
  totalHours?: number;

  @IsOptional()
  @IsNumber()
  hourlyRate?: number;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsIn(['ACTIVE', 'EXPIRED', 'CANCELLED'])
  status?: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsIn(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL'])
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';

  @IsOptional()
  @IsString()
  quoteId?: string;

  // Replaces the full set of linked assets when provided (not a merge) — matches how the AMC
  // edit form's multi-select naturally submits "here is the current full list."
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  assetIds?: string[];
}
