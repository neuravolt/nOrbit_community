import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuoteLineItemDto {
  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  itemType?: string; // SERVICE | CUSTOM | DISCOUNT | FREE

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  longDescription?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class MilestoneScheduleItemDto {
  @IsString()
  milestone: string;

  @Type(() => Number)
  @IsNumber()
  percentage: number;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class CreateQuoteDto {
  @IsString()
  clientId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @IsOptional()
  @IsArray()
  milestoneSchedule?: MilestoneScheduleItemDto[];

  @IsOptional()
  @IsString()
  scopeOfWork?: string;

  @IsOptional()
  @IsString()
  exclusions?: string;

  @IsOptional()
  thirdPartyExpenses?: any[];

  @IsOptional()
  @IsString()
  termsConditions?: string;

  @IsOptional()
  @IsString()
  quoteType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineItemDto)
  items?: QuoteLineItemDto[];
}

export class UpdateQuoteDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @IsOptional()
  milestoneSchedule?: any[];

  @IsOptional()
  @IsString()
  scopeOfWork?: string;

  @IsOptional()
  @IsString()
  exclusions?: string;

  @IsOptional()
  thirdPartyExpenses?: any[];

  @IsOptional()
  @IsString()
  termsConditions?: string;

  @IsOptional()
  @IsString()
  quoteType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineItemDto)
  items?: QuoteLineItemDto[];
}

export class ListQuotesQuery {
  page?: number;
  limit?: number;
  status?: string;
  clientId?: string;
  search?: string;
  sort?: string;
  sortOrder?: 'asc' | 'desc';
}
