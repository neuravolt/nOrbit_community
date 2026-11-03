export class CreateInvoiceItemDto {
  description: string;
  quantity?: number;
  unitPrice: number;
}

export class UpdateInvoiceItemDto {
  id?: string;
  description: string;
  quantity?: number;
  unitPrice: number;
}

export class InvoiceItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}
