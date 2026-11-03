import {
  IsString,
  IsOptional,
  IsNumber,
  IsEmail,
  IsUrl,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertCompanyProfileDto {
  @IsString()
  companyName: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  cinNumber?: string;

  @IsOptional()
  @IsString()
  msmeRegistration?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  ifscCode?: string;

  @IsOptional()
  @IsString()
  accountHolderName?: string;

  @IsOptional()
  @IsString()
  upiId?: string;

  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @IsOptional()
  @IsString()
  quotePrefix?: string;

  @IsOptional()
  @IsString()
  amcPrefix?: string;

  @IsOptional()
  @IsString()
  amcReportPrefix?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  defaultGstRate?: number;

  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(365)
  defaultPaymentTerms?: number;

  @IsOptional()
  @IsString()
  invoiceTerms?: string;

  @IsOptional()
  @IsString()
  quoteTerms?: string;

  @IsOptional()
  @IsString()
  amcTerms?: string;

  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @IsOptional()
  @IsString()
  stampUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  paymentGateway?: 'MANUAL' | 'RAZORPAY';

  @IsOptional()
  @IsString()
  razorpayKeyId?: string;

  @IsOptional()
  @IsString()
  razorpayKeySecret?: string;

  @IsOptional()
  @IsBoolean()
  onlinePaymentEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  manualPaymentEnabled?: boolean;

  @IsOptional()
  @IsString()
  activeOnlineGateway?: string;

  @IsOptional()
  @IsString()
  cashfreeAppId?: string;

  @IsOptional()
  @IsString()
  cashfreeSecretKey?: string;

  @IsOptional()
  @IsString()
  cashfreeEnvironment?: 'sandbox' | 'production';

  @IsOptional()
  @IsString()
  cashfreeWebhookSecret?: string;

  @IsOptional()
  @IsString()
  cashfreeSandboxAppId?: string;

  @IsOptional()
  @IsString()
  cashfreeSandboxSecretKey?: string;

  @IsOptional()
  @IsString()
  cashfreeSandboxWebhookSecret?: string;

  @IsOptional()
  @IsString()
  cashfreeProductionAppId?: string;

  @IsOptional()
  @IsString()
  cashfreeProductionSecretKey?: string;

  @IsOptional()
  @IsString()
  cashfreeProductionWebhookSecret?: string;
}
