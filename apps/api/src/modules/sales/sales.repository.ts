import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const QUOTE_INCLUDE = {
  client: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      tier: true,
    },
  },
  lineItems: {
    include: {
      service: {
        select: { id: true, name: true, serviceCode: true, unitType: true },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  invoices: true,
};

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.quote.findUnique({
      where: { id },
      include: QUOTE_INCLUDE,
    });
  }

  async findAll(query: any, organizationId?: string | null) {
    const {
      page = 1,
      limit = 20,
      status,
      clientId,
      search,
      sort = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { deletedAt: null };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (search)
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { quoteNumber: { contains: search, mode: 'insensitive' } },
      ];

    const [quotes, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sort]: sortOrder },
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { lineItems: true } },
          amcContract: { select: { id: true } },
          asset: { select: { id: true } },
          invoices: { select: { id: true, invoiceNumber: true } },
        },
      }),
      this.prisma.quote.count({ where }),
    ]);

    return {
      quotes,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async create(data: any) {
    return this.prisma.quote.create({ data, include: QUOTE_INCLUDE });
  }

  async update(id: string, data: any) {
    return this.prisma.quote.update({
      where: { id },
      data,
      include: QUOTE_INCLUDE,
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.quote.update({
      where: { id },
      data: { status },
      include: QUOTE_INCLUDE,
    });
  }

  async softDelete(id: string) {
    return this.prisma.quote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findExpiredQuotes() {
    return this.prisma.quote.findMany({
      where: {
        deletedAt: null,
        status: { in: ['DRAFT', 'SENT'] },
        validUntil: { lt: new Date() },
      },
    });
  }

  async generateQuoteNumber(prefix = 'QUO'): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const latest = await this.prisma.quote.findFirst({
      where: { quoteNumber: { startsWith: `${prefix}-${year}-${month}` } },
      orderBy: { quoteNumber: 'desc' },
    });
    let seq = 1;
    if (latest && latest.quoteNumber) {
      const parts = latest.quoteNumber.split('-');
      const last = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(last)) seq = last + 1;
    }
    return `${prefix}-${year}-${month}-${String(seq).padStart(5, '0')}`;
  }

  async deleteLineItems(quoteId: string) {
    return this.prisma.quoteLineItem.deleteMany({ where: { quoteId } });
  }
}
