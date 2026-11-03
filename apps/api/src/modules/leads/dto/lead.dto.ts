export class LeadDto {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source: string;
  status: string;
  estimatedValue?: number;
  notes?: string;
  convertedToClientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class LeadListItemDto {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source: string;
  status: string;
  estimatedValue?: number;
  notes?: string;
  convertedToClientId?: string;
  createdAt: Date;
}

export class ListLeadsResponseDto {
  leads: LeadListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

export class ConvertedClientDto {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  status: string;
  industry?: string;
  contacts: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    isPrimary: boolean;
  }[];
  createdAt: Date;
  updatedAt: Date;
}
