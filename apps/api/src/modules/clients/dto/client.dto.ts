export class ClientDto {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  status: string;
  industry?: string;
  gstNumber?: string;
  notes?: string;
  contacts: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    isPrimary: boolean;
  }[];
  clientUser?: {
    id: string;
    email: string;
    portalEnabled: boolean;
    isActive: boolean;
    lastLoginAt?: Date;
  };
  projectCount: number;
  collectEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ClientListDto {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  industry?: string;
  gstNumber?: string;
  collectEnabled?: boolean;
  contactCount: number;
  projectCount: number;
  clientUser?: {
    id: string;
    portalEnabled: boolean;
    isActive: boolean;
  };
  createdAt: Date;
}

export class ListClientsResponseDto {
  clients: ClientListDto[];
  total: number;
  page: number;
  limit: number;
}

export class ContactPersonResponseDto {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}
