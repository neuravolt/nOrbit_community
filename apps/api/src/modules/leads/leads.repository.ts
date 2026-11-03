import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLeadDto, UpdateLeadDto, ListLeadsQuery } from './dto';

@Injectable()
export class LeadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return (this.prisma.lead as any).findUnique({
      where: { id },
      include: { convertedClient: true },
    });
  }

  async findByEmail(email: string) {
    // Lead.email is indexed but not unique — must use findFirst
    return (this.prisma.lead as any).findFirst({
      where: { email, deletedAt: null },
    });
  }

  async findAll(query: ListLeadsQuery, organizationId?: string | null) {
    const {
      page = 1,
      limit = 20,
      status,
      source,
      search,
      sort = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (status) {
      where.status = status;
    }

    if (source) {
      where.source = source;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      (this.prisma.lead as any).findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sort]: sortOrder },
      }),
      (this.prisma.lead as any).count({ where }),
    ]);

    return {
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(createLeadDto: CreateLeadDto) {
    return (this.prisma.lead as any).create({
      data: {
        ...createLeadDto,
        status: 'new',
        source: createLeadDto.source || 'Other',
      },
      include: { convertedClient: true },
    });
  }

  async update(id: string, updateLeadDto: UpdateLeadDto) {
    return (this.prisma.lead as any).update({
      where: { id },
      data: updateLeadDto,
      include: { convertedClient: true },
    });
  }

  async softDelete(id: string) {
    return (this.prisma.lead as any).update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    return (this.prisma.lead as any).update({
      where: { id },
      data: { deletedAt: null },
      include: { convertedClient: true },
    });
  }

  async markAsConverted(leadId: string, clientId: string) {
    return (this.prisma.lead as any).update({
      where: { id: leadId },
      data: {
        status: 'converted',
        convertedToClientId: clientId,
      },
      include: { convertedClient: true },
    });
  }

  async countLeadsByStatus(status: string) {
    return (this.prisma.lead as any).count({
      where: { status, deletedAt: null },
    });
  }

  async getConversionMetrics() {
    const total = await (this.prisma.lead as any).count({
      where: { deletedAt: null },
    });
    const converted = await (this.prisma.lead as any).count({
      where: { status: 'converted', deletedAt: null },
    });
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;

    return {
      totalLeads: total,
      convertedLeads: converted,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
    };
  }

  async getLeadsByStatus(statuses: string[]) {
    return (this.prisma.lead as any).findMany({
      where: {
        status: { in: statuses },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
