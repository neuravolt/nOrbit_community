import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsIn,
  IsOptional,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const VALID_PAYMENT_METHODS = [
  'BANK_TRANSFER',
  'UPI',
  'CHEQUE',
  'CASH',
] as const;
export type PaymentMethodType = (typeof VALID_PAYMENT_METHODS)[number];

export class SubmitManualPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'Amount must be a positive number' })
  amount: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(VALID_PAYMENT_METHODS as any, {
    message: `Payment method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`,
  })
  paymentMethod: PaymentMethodType;

  @IsString()
  @IsNotEmpty()
  @MinLength(4, {
    message: 'UTR / Transaction reference must be at least 4 characters',
  })
  @MaxLength(50, {
    message: 'UTR / Transaction reference must not exceed 50 characters',
  })
  utrNumber: string;

  @IsDateString({}, { message: 'Payment date must be a valid ISO date string' })
  paymentDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Notes must not exceed 500 characters' })
  notes?: string;
}

export class RejectManualPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @MaxLength(500, {
    message: 'Rejection reason must not exceed 500 characters',
  })
  rejectionReason: string;
}

export class ListManualPaymentsQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
