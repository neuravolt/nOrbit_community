import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  ListInvoicesQuery,
  RecordPaymentDto,
} from './dto';

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const key = `INV-${year}`;

    // Get the highest invoice number for this year
    const latest = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: key } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let sequence = 1;
    if (latest) {
      const match = latest.invoiceNumber.match(/INV-\d+-(\d+)/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    let candidate = `${key}-${String(sequence).padStart(5, '0')}`;
    while (
      await this.prisma.invoice.findUnique({
        where: { invoiceNumber: candidate },
      })
    ) {
      sequence++;
      candidate = `${key}-${String(sequence).padStart(5, '0')}`;
    }
    return candidate;
  }

  async findById(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
  }

  async findAll(query: ListInvoicesQuery, organizationId?: string | null) {
    const {
      page = 1,
      limit = 20,
      status,
      clientId,
      startDate,
      endDate,
      overdue,
      sort = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (status) {
      where.status = status;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) where.issueDate.gte = new Date(startDate);
      if (endDate) where.issueDate.lte = new Date(endDate);
    }

    if (overdue === true || overdue === 'true') {
      where.status = { not: 'PAID' };
      where.dueDate = { lt: new Date() };
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: sortOrder },
        include: {
          client: { select: { id: true, name: true } },
          lineItems: true,
          _count: { select: { payments: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(
    createInvoiceDto: CreateInvoiceDto,
    organizationId?: string | null,
  ) {
    const { items, taxRate = 0.1, ...invoiceData } = createInvoiceDto;

    // Calculate subtotal from items
    const subTotal = items.reduce(
      (sum, item) =>
        sum + Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0),
      0,
    );
    const taxAmount = subTotal * taxRate;
    const totalAmount = subTotal + taxAmount;

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        ...invoiceData,
        organizationId: organizationId || undefined,
        subTotal,
        taxAmount,
        totalAmount,
        status: 'DRAFT',
        lineItems: {
          create: items.map((item) => ({
            description: item.description ?? '',
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            amount: Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0),
          })),
        },
      },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        lineItems: true,
        payments: true,
      },
    });
  }

  async update(id: string, updateInvoiceDto: UpdateInvoiceDto) {
    const { items, taxRate, ...invoiceData } = updateInvoiceDto;
    let updateData: any = invoiceData;

    if (items) {
      // Get current invoice to get taxRate
      const current = await this.prisma.invoice.findUnique({ where: { id } });
      if (!current) throw new Error(`Invoice ${id} not found`);
      const effectiveTaxRate = taxRate ?? current.taxRate;

      // Delete existing items
      await this.prisma.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      // Recalculate totals
      const subTotal = items.reduce(
        (sum, item) =>
          sum + Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0),
        0,
      );

      const taxAmount = subTotal * Number(effectiveTaxRate);
      const totalAmount = subTotal + taxAmount;

      updateData = {
        ...invoiceData,
        subTotal,
        taxAmount,
        totalAmount,
        lineItems: {
          create: items.map((item) => ({
            description: item.description ?? '',
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            amount: (item.quantity ?? 1) * (item.unitPrice ?? 0),
          })),
        },
      };
    } else if (taxRate) {
      // Recalculate with new tax rate if only taxRate changed
      const current = await this.prisma.invoice.findUnique({ where: { id } });
      if (!current) throw new Error(`Invoice ${id} not found`);
      const newTaxAmount = Number(current.subTotal) * Number(taxRate);
      const newTotal = Number(current.subTotal) + newTaxAmount;

      updateData = {
        ...invoiceData,
        taxRate,
        taxAmount: newTaxAmount,
        totalAmount: newTotal,
      };
    }

    return this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        lineItems: true,
        payments: true,
      },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.invoice.update({
      where: { id },
      data: { status },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        lineItems: true,
        payments: true,
      },
    });
  }

  async softDelete(id: string) {
    return this.prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findOverdue() {
    return this.prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { not: 'PAID' },
        dueDate: { lt: new Date() },
      },
      include: {
        client: { select: { id: true, name: true } },
        lineItems: true,
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async recordPayment(invoiceId: string, recordPaymentDto: RecordPaymentDto) {
    const { amount, method, transactionId, paidAt } = recordPaymentDto;

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId,
        amount,
        method,
        transactionId,
        notes: (recordPaymentDto as any).notes ?? null,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
      },
    });

    // Get invoice to update amountPaid
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
    const currentPaid = invoice.amountPaid ? Number(invoice.amountPaid) : 0;
    const newAmountPaid = currentPaid + Number(amount);

    // Determine if invoice is now fully paid
    let status = invoice.status;
    if (newAmountPaid >= Number(invoice.totalAmount)) {
      status = 'PAID';
    } else if (
      status === 'OVERDUE' ||
      (invoice.dueDate < new Date() && status !== 'PAID')
    ) {
      status = 'OVERDUE';
    }

    // Update invoice
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        status,
      },
    });

    return payment;
  }

  async getPayments(invoiceId: string) {
    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paidAt: 'desc' },
    });
  }

  async updateOverdueStatus() {
    // Find all non-paid invoices past due date
    const overdue = await this.prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { not: 'PAID' },
        dueDate: { lt: new Date() },
      },
    });

    // Update their status to OVERDUE if not already
    for (const invoice of overdue) {
      if (invoice.status !== 'OVERDUE') {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'OVERDUE' },
        });
      }
    }

    return { updated: overdue.length };
  }
}
