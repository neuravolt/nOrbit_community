import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsIn,
  IsDateString,
  IsUUID,
} from 'class-validator';

export type AssetType =
  | 'DOMAIN'
  | 'HOSTING'
  | 'VPS'
  | 'WEBSITE'
  | 'ADMIN_PANEL'
  | 'MOBILE_APP'
  | 'API_SERVICE'
  | 'SSL_CERTIFICATE';

export class DomainMetadata {
  registrar?: string;
  expiryDate?: Date;
  dnsRecords?: string[];
  autoRenew?: boolean;
}

export class HostingMetadata {
  provider?: string;
  plan?: string;
  serverIp?: string;
  controlPanelUrl?: string;
  controlPanelUsername?: string;
  controlPanelPassword?: string;
}

export class VpsMetadata {
  provider?: string;
  ipAddress?: string;
  os?: string;
  cpu?: number;
  ram?: number;
  disk?: number;
  status?: string;
  rootUsername?: string;
  rootPassword?: string;
  sshPort?: number;
}

export class SslMetadata {
  issuer?: string;
  expiryDate?: Date;
  domainsCovered?: string[];
  certificateUrl?: string;
}

export class WebsiteMetadata {
  url?: string;
  cms?: string;
  hostingAssetId?: string;
  adminUrl?: string;
  adminUsername?: string;
  adminPassword?: string;
}

export class AdminPanelMetadata {
  url?: string;
  username?: string;
  password?: string;
  purpose?: string;
}

export class MobileAppMetadata {
  platform?: 'iOS' | 'Android' | 'Both';
  appStoreLink?: string;
  playStoreLink?: string;
  version?: string;
}

export class ApiServiceMetadata {
  baseUrl?: string;
  apiKey?: string;
  documentation?: string;
  status?: string;
}

export class CreateAssetDto {
  @IsNotEmpty({ message: 'Client ID is required' })
  @IsUUID(4, { message: 'Client ID must be a valid UUID' })
  clientId: string;

  @IsNotEmpty({ message: 'Asset name is required' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Asset type is required' })
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
    { message: 'Invalid asset type' },
  )
  type: AssetType;

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
