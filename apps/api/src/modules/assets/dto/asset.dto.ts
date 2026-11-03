import {
  AssetType,
  DomainMetadata,
  HostingMetadata,
  VpsMetadata,
  SslMetadata,
  WebsiteMetadata,
  AdminPanelMetadata,
  MobileAppMetadata,
  ApiServiceMetadata,
} from './create-asset.dto';

export class AssetDto {
  id: string;
  guardianAgentId?: string | null;
  clientId: string;
  name: string;
  type: AssetType;
  description?: string;
  metadata?:
    | DomainMetadata
    | HostingMetadata
    | VpsMetadata
    | SslMetadata
    | WebsiteMetadata
    | AdminPanelMetadata
    | MobileAppMetadata
    | ApiServiceMetadata;
  renewalDate?: Date;
  daysUntilRenewal?: number;
  isRenewalUpcoming: boolean;
  isExpired: boolean;
  cost?: number;
  billingCycle?: string;
  notes?: string;
  guardianMode?: string;
  guardianOwnership?: string;
  createdAt: Date;
  updatedAt: Date;
  client?: {
    id: string;
    name: string;
    email: string;
  };
}

export class AssetListItemDto {
  id: string;
  clientId: string;
  name: string;
  type: AssetType;
  renewalDate?: Date;
  daysUntilRenewal?: number;
  isRenewalUpcoming: boolean;
  isExpired: boolean;
  cost?: number;
  billingCycle?: string;
  guardianMode?: string;
  guardianOwnership?: string;
  createdAt: Date;
  client?: {
    id: string;
    name: string;
  };
}

export class ListAssetsResponseDto {
  assets: AssetListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class UpcomingRenewalDto {
  id: string;
  name: string;
  type: AssetType;
  clientId: string;
  clientName: string;
  renewalDate: Date;
  daysUntilRenewal: number;
  cost?: number;
  billingCycle?: string;
}
