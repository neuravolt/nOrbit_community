import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsUUID,
  IsOptional,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { HrDocumentType } from '@prisma/client';

export class GenerateHrDocumentDto {
  @IsNotEmpty()
  @IsUUID(4, { message: 'Employee ID must be a valid UUID' })
  employeeId: string;

  @IsNotEmpty()
  @IsEnum(HrDocumentType, { message: 'Invalid HR document type' })
  type: HrDocumentType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Template variables (optional)
  @IsOptional()
  @IsNumber()
  basicSalary?: number;

  @IsOptional()
  @IsNumber()
  allowances?: number;

  @IsOptional()
  @IsNumber()
  deductions?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  terms?: string;

  // Detailed salary component breakdown (optional)
  @IsOptional()
  @IsNumber()
  hra?: number;

  @IsOptional()
  @IsNumber()
  conveyance?: number;

  @IsOptional()
  @IsNumber()
  specialAllowance?: number;

  @IsOptional()
  @IsNumber()
  performanceIncentive?: number;

  @IsOptional()
  @IsNumber()
  pf?: number;

  @IsOptional()
  @IsNumber()
  esi?: number;

  @IsOptional()
  @IsNumber()
  professionalTax?: number;

  @IsOptional()
  @IsNumber()
  tds?: number;

  @IsOptional()
  @IsNumber()
  otherDeductions?: number;

  @IsOptional()
  @IsString()
  paymentMode?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsNumber()
  da?: number;

  @IsOptional()
  @IsNumber()
  gis?: number;

  @IsOptional()
  @IsNumber()
  npsEmployee?: number;

  @IsOptional()
  @IsNumber()
  npsGovt?: number;

  @IsOptional()
  @IsString()
  pran?: string;

  @IsOptional()
  @IsNumber()
  workingDays?: number;

  @IsOptional()
  @IsString()
  voucherNo?: string;

  @IsOptional()
  @IsString()
  voucherDate?: string;

  @IsOptional()
  @IsNumber()
  voucherGross?: number;

  @IsOptional()
  @IsNumber()
  voucherNet?: number;
}
