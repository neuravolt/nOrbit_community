export class AmcHourLogDto {
  id: string;
  contractId: string;
  hours: number;
  description: string;
  linkedTicketId?: string;
  linkedTaskId?: string;
  loggedAt: Date;
  loggedBy?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export class AmcContractDto {
  id: string;
  clientId: string;
  contractNumber: string;
  startDate: Date;
  endDate: Date;
  totalHours: number;
  usedHours: number;
  remainingHours: number;
  usagePercentage: number;
  hourlyRate: number;
  totalValue: number;
  usedValue: number;
  status: string;
  isExpired: boolean;
  isRenewalDue: boolean;
  daysUntilExpiry?: number;
  terms?: string;
  autoRenew: boolean;
  discount?: number;
  billingCycle: string;
  monthlyValue?: number;
  createdAt: Date;
  updatedAt: Date;
  client?: {
    id: string;
    name: string;
    email: string;
  };
  hourLogs?: AmcHourLogDto[];
  tasks?: any[];
  tickets?: any[];
  hoursNearLimit?: boolean;
  hourLogCount?: number;
  invoiceCount?: number;
  assets?: {
    id: string;
    name: string;
    type: string;
    guardianStatus?: string;
    renewalDate?: Date | null;
  }[];
}

export class AmcContractListItemDto {
  id: string;
  contractNumber: string;
  clientId: string;
  clientName: string;
  startDate: Date;
  endDate: Date;
  totalHours: number;
  usedHours: number;
  usagePercentage: number;
  status: string;
  isExpired: boolean;
  isRenewalDue: boolean;
  daysUntilExpiry?: number;
  hoursNearLimit: boolean;
  hourlyRate: number;
  discount?: number;
  billingCycle: string;
  monthlyValue?: number;
  invoiceCount?: number;
  assets?: { id: string; name: string }[];
}

export class ListAmcContractsResponseDto {
  contracts: AmcContractListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class RenewalDueDto {
  id: string;
  contractNumber: string;
  clientId: string;
  clientName: string;
  endDate: Date;
  daysUntilExpiry: number;
  totalHours: number;
  usedHours: number;
  hourlyRate: number;
  autoRenew: boolean;
}

export class AmcUsageStatsDto {
  contractId: string;
  contractNumber: string;
  totalHours: number;
  usedHours: number;
  remainingHours: number;
  usagePercentage: number;
  hoursNearLimit: boolean;
  totalValue: number;
  usedValue: number;
  logCount: number;
}
