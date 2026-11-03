import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsDateString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DomainMetadata,
  HostingMetadata,
  VpsMetadata,
  SslMetadata,
  WebsiteMetadata,
  AdminPanelMetadata,
  MobileAppMetadata,
  ApiServiceMetadata,
} from './create-asset.dto';

export class UpdateAssetDto {
  @IsOptional()
  @IsUUID(4, { message: 'Client ID must be a valid UUID' })
  clientId?: string;

  @IsOptional()
  @IsString()
  @IsIn(
    [
      'DOMAIN',
      'HOSTING',
      'VPS',
      'WEBSITE',
      'ADMIN_PANEL',
      'MOBILE_APP',
      'API_SERVICE',
      'SSL_CERTIFICATE',
    ],
    {
      message: 'Invalid asset type',
    },
  )
  type?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  metadata?:
    | DomainMetadata
    | HostingMetadata
    | VpsMetadata
    | SslMetadata
    | WebsiteMetadata
    | AdminPanelMetadata
    | MobileAppMetadata
    | ApiServiceMetadata;

  @IsOptional()
  @IsDateString()
  renewalDate?: Date;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsIn(['MONTHLY', 'QUARTERLY', 'ANNUALLY'], {
    message: 'Billing cycle must be one of: MONTHLY, QUARTERLY, ANNUALLY',
  })
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  guardianMode?: string;

  @IsOptional()
  @IsString()
  guardianOwnership?: string;
}
