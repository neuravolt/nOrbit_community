import {
  CreateInvoiceItemDto,
  UpdateInvoiceItemDto,
  InvoiceItemDto,
} from './invoice-item.dto';

export class CreateInvoiceDto {
  clientId: string;
  issueDate: string | Date;
  dueDate: string | Date;
  items: CreateInvoiceItemDto[];
  taxRate?: number; // Optional, default is 0 or configurable e.g., 0.18
  notes?: string;
  assetId?: string;
  amcContractId?: string;
}

export class UpdateInvoiceDto {
  issueDate?: string | Date;
  dueDate?: string | Date;
  items?: UpdateInvoiceItemDto[];
  taxRate?: number;
  notes?: string;
  assetId?: string;
  amcContractId?: string;
}

export class RecordPaymentDto {
  amount: number;
  method: string;
  transactionId?: string;
  paidAt?: string | Date;
  notes?: string;
  receiptUrl?: string;
}

export class ListInvoicesQuery {
  page?: number = 1;
  limit?: number = 20;
  status?: string;
  clientId?: string;
  amcContractId?: string;
  startDate?: string;
  endDate?: string;
  overdue?: boolean | string;
  sort?: string = 'createdAt';
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PaymentDto {
  id: string;
  amount: number;
  method: string;
  transactionId?: string;
  paidAt: Date;
  notes?: string;
}

export class InvoiceDto {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  subTotal: number;
  taxAmount: number;
  taxRate: number;
  totalAmount: number;
  amountPaid: number;
  notes?: string;
  clientId: string;
  client?: {
    id: string;
    name: string;
    email?: string;
  };
  items: InvoiceItemDto[];
  payments: PaymentDto[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
