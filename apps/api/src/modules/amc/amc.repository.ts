import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateAmcContractDto,
  UpdateAmcContractDto,
  ListAmcContractsQuery,
  LogAmcHoursDto,
} from './dto';

@Injectable()
export class AmcRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.amcContract.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        hourLogs: {
          include: {
            loggedBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { loggedAt: 'desc' },
        },
        tasks: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
            taskCode: true,
            totalTimeLogged: true,
            estimatedHours: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        tickets: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            category: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        assets: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            type: true,
            guardianStatus: true,
            renewalDate: true,
          },
        },
        _count: { select: { invoices: true } },
      },
    });
  }

  async findAll(
    query: ListAmcContractsQuery,
    organizationId?: string | null,
  ) {
    const {
      page = 1,
      limit = 20,
      status,
      clientId,
      expiryFrom,
      expiryTo,
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

    if (clientId) {
      where.clientId = clientId;
    }

    if (expiryFrom || expiryTo) {
      where.endDate = {};
      if (expiryFrom) where.endDate.gte = expiryFrom;
      if (expiryTo) where.endDate.lte = expiryTo;
    }

    if (search) {
      where.OR = [
        { contractNumber: { contains: search, mode: 'insensitive' } },
        { terms: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [contracts, total] = await Promise.all([
      this.prisma.amcContract.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sort]: sortOrder },
        include: {
          client: { select: { id: true, name: true } },
          assets: { select: { id: true, name: true } },
          _count: { select: { hourLogs: true, invoices: true } },
        },
      }),
      this.prisma.amcContract.count({ where }),
    ]);

    return {
      contracts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(createAmcDto: any) {
    const {
      clientId,
      contractNumber,
      startDate,
      endDate,
      totalHours,
      hourlyRate,
      terms,
      autoRenew,
      discount,
      billingCycle,
      quoteId,
      assetIds,
    } = createAmcDto;
    const startD = new Date(startDate);
    const endD = new Date(endDate);

    let months = (endD.getFullYear() - startD.getFullYear()) * 12;
    months -= startD.getMonth();
    months += endD.getMonth();
    if (months <= 0) months = 1;

    const totalVal = Number(totalHours) * Number(hourlyRate);
    const monthlyValue = totalVal / months;
    const annualValue = monthlyValue * 12;

    return this.prisma.amcContract.create({
      data: {
        clientId,
        contractNumber,
        startDate: startD,
        endDate: endD,
        totalHours: Math.round(Number(totalHours)),
        hourlyRate: Number(hourlyRate),
        terms: terms || null,
        autoRenew: autoRenew || false,
        discount: Number(discount ?? 0),
        usedHours: 0,
        status: 'ACTIVE',
        nextBillingDate: startD,
        monthlyValue,
        annualValue,
        billingCycle: billingCycle || 'MONTHLY',
        quoteId: quoteId || null,
        ...(assetIds?.length
          ? { assets: { connect: assetIds.map((id: string) => ({ id })) } }
          : {}),
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        assets: { select: { id: true, name: true, type: true } },
      },
    });
  }

  async update(id: string, updateAmcDto: UpdateAmcContractDto) {
    const existing = await this.prisma.amcContract.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`AMC Contract ${id} not found`);
    }

    const startDate = updateAmcDto.startDate
      ? new Date(updateAmcDto.startDate)
      : existing.startDate;
    const endDate = updateAmcDto.endDate
      ? new Date(updateAmcDto.endDate)
      : existing.endDate;
    const totalHours =
      updateAmcDto.totalHours !== undefined
        ? Number(updateAmcDto.totalHours)
        : existing.totalHours;
    const hourlyRate =
      updateAmcDto.hourlyRate !== undefined
        ? Number(updateAmcDto.hourlyRate)
        : existing.hourlyRate;

    let months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
    months -= startDate.getMonth();
    months += endDate.getMonth();
    if (months <= 0) months = 1;

    const totalVal = totalHours * hourlyRate;
    const monthlyValue = totalVal / months;
    const annualValue = monthlyValue * 12;

    // assetIds isn't a real column on AmcContract — pulled out before the raw spread below so
    // Prisma never sees it as a plain field (it would throw "Unknown argument `assetIds`").
    const { assetIds, ...updateFields } = updateAmcDto as any;

    return this.prisma.amcContract.update({
      where: { id },
      data: {
        ...updateFields,
        startDate,
        endDate,
        totalHours,
        hourlyRate,
        discount:
          updateAmcDto.discount !== undefined
            ? Number(updateAmcDto.discount)
            : undefined,
        monthlyValue,
        annualValue,
        quoteId: updateAmcDto.quoteId === '' ? null : updateAmcDto.quoteId,
        // `set` replaces the full linked-assets list — matches the "submit the current full
        // selection" semantics of a multi-select edit form. Only touched when the caller
        // actually sent assetIds, so a PATCH that doesn't mention assets leaves them untouched.
        ...(assetIds !== undefined
          ? {
              assets: {
                set: assetIds.map((assetId: string) => ({ id: assetId })),
              },
            }
          : {}),
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        hourLogs: {
          include: {
            loggedBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        assets: { select: { id: true, name: true, type: true } },
      },
    });
  }

  async updateUsedHours(id: string, hoursToAdd: number) {
    return this.prisma.amcContract.update({
      where: { id },
      data: { usedHours: { increment: hoursToAdd } },
    });
  }

  async renew(
    id: string,
    newEndDate: Date,
    resetHours: boolean,
    newTotalHours?: number,
  ) {
    const data: any = {
      endDate: newEndDate,
      status: 'ACTIVE',
    };

    if (resetHours) {
      data.usedHours = 0;
      if (newTotalHours) {
        data.totalHours = newTotalHours;
      }
    }

    return this.prisma.amcContract.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true, email: true } },
        hourLogs: true,
      },
    });
  }

  async softDelete(id: string) {
    return this.prisma.amcContract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    return this.prisma.amcContract.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async findByContractNumber(contractNumber: string) {
    return this.prisma.amcContract.findUnique({
      where: { contractNumber },
    });
  }

  async findRenewalsDue(
    daysThreshold: number = 30,
    organizationId?: string | null,
  ) {
    const where: any = {
      deletedAt: null,
      status: 'ACTIVE',
      endDate: {
        lte: new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000),
        gte: new Date(),
      },
    };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.prisma.amcContract.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
      },
      orderBy: { endDate: 'asc' },
    });
  }

  async findExpiredContracts() {
    return this.prisma.amcContract.findMany({
      where: {
        deletedAt: null,
        endDate: {
          lt: new Date(),
        },
      },
      include: {
        client: { select: { id: true, name: true } },
      },
    });
  }

  // Hour Logs
  async logHours(
    contractId: string,
    userId: string,
    logAmcHoursDto: LogAmcHoursDto,
  ) {
    return this.prisma.amcHourLog.create({
      data: {
        contractId,
        loggedById: userId,
        hours: logAmcHoursDto.hours,
        description: logAmcHoursDto.description,
        linkedTicketId: logAmcHoursDto.linkedTicketId,
        linkedTaskId: logAmcHoursDto.linkedTaskId,
      },
      include: {
        loggedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async findHourLogs(contractId: string) {
    return this.prisma.amcHourLog.findMany({
      where: { contractId },
      include: {
        loggedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { loggedAt: 'desc' },
    });
  }

  async getHourLogCount(contractId: string) {
    return this.prisma.amcHourLog.count({
      where: { contractId },
    });
  }

  async getTotalLoggedHours(contractId: string) {
    const result = await this.prisma.amcHourLog.aggregate({
      where: { contractId },
      _sum: { hours: true },
    });
    return result._sum?.hours || 0;
  }
}
