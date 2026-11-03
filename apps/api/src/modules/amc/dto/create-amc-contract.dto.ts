import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsUUID,
  IsIn,
  IsNotEmpty,
  IsArray,
} from 'class-validator';

export class CreateAmcContractDto {
  @IsNotEmpty()
  @IsUUID(4, { message: 'Client ID must be a valid UUID' })
  clientId: string;

  @IsNotEmpty()
  @IsString()
  contractNumber: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: Date;

  @IsNotEmpty()
  @IsDateString()
  endDate: Date;

  @IsNotEmpty()
  @IsNumber()
  totalHours: number;

  @IsNotEmpty()
  @IsNumber()
  hourlyRate: number;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsIn(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL'])
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL';

  @IsOptional()
  @IsString()
  quoteId?: string;

  // Which Assets (VPS/hosting/etc.) this contract covers — optional since a contract may be
  // purely client-level (e.g. a generic support retainer with no specific asset attached).
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  assetIds?: string[];
}
