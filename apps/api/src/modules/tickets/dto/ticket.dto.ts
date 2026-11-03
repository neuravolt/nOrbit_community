export class TicketCommentDto {
  id: string;
  ticketId: string;
  userId?: string;
  clientUserId?: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  clientUser?: {
    id: string;
    name: string;
  };
}

export class TicketDto {
  id: string;
  clientId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  assignedToId?: string;
  slaDeadline: Date;
  slaBreached: boolean;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comments: TicketCommentDto[];
  attachments: any[];
  client?: {
    id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  projectId?: string;
  amcContractId?: string;
  project?: any;
  amcContract?: any;
}

export class TicketListItemDto {
  id: string;
  clientId: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  assignedToId?: string;
  slaDeadline: Date;
  slaBreached: boolean;
  createdAt: Date;
  updatedAt: Date;
  client?: {
    id: string;
    name: string;
  };
  assignedTo?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  projectId?: string;
  amcContractId?: string;
  project?: any;
  amcContract?: any;
}

export class ListTicketsResponseDto {
  tickets: TicketListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
