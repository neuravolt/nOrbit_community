import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CreateQuoteItemDto,
  UpdateQuoteItemDto,
  QuoteItemDto,
} from './quote-item.dto';

export class CreateQuoteDto {
  @IsString()
  clientId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items: CreateQuoteItemDto[];

  @IsDateString()
  validUntil: Date;

  @IsOptional()
  @IsString()
  quoteType?: string;
}

export class UpdateQuoteDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateQuoteItemDto)
  items?: UpdateQuoteItemDto[];

  @IsOptional()
  @IsDateString()
  validUntil?: Date;

  @IsOptional()
  @IsString()
  quoteType?: string;
}

export class SendQuoteDto {
  // No additional fields needed, just trigger status change
}

export class AcceptQuoteDto {
  // No additional fields needed, just trigger status change
}

export class RejectQuoteDto {
  // No additional fields needed, just trigger status change
}

export class ListQuotesQuery {
  page?: number = 1;
  limit?: number = 20;
  status?: string;
  clientId?: string;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  sort?: string = 'createdAt';
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class QuoteDto {
  id: string;
  clientId: string;
  client?: {
    id: string;
    name: string;
    email?: string;
  };
  title: string;
  description?: string;
  items: QuoteItemDto[];
  totalAmount: number;
  status: string;
  validUntil?: Date;
  isExpired?: boolean;
  daysUntilExpiry?: number;
  quoteType: string;
  createdAt: Date;
  updatedAt: Date;
}

export class QuoteListItemDto {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  totalAmount: number;
  status: string;
  validUntil?: Date;
  isExpired: boolean;
  daysUntilExpiry?: number;
  itemCount: number;
  quoteType: string;
  createdAt: Date;
}

export class ListQuotesResponseDto {
  quotes: QuoteListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
