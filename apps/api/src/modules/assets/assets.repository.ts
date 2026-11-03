import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAssetDto, UpdateAssetDto, ListAssetsQuery } from './dto';

@Injectable()
export class AssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Read — single asset
  // ---------------------------------------------------------------------------

  async findById(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.prisma.asset.findFirst({
      where,
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Read — list
  // ---------------------------------------------------------------------------

  async findAll(query: ListAssetsQuery, organizationId?: string) {
    const {
      page = 1,
      limit = 20,
      type,
      clientId,
      renewalStatus,
      search,
      sort = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (type) {
      where.type = type as any;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sort]: sortOrder },
        include: {
          client: { select: { id: true, name: true } },
        },
      }),
      this.prisma.asset.count({ where }),
    ]);

    return {
      assets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---------------------------------------------------------------------------
  // Read — by client
  // ---------------------------------------------------------------------------

  async findByClientId(clientId: string) {
    return this.prisma.asset.findMany({
      where: { clientId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true } },
      },
    });
  }

  async findByType(type: string) {
    return this.prisma.asset.findMany({
      where: { type: type as any, deletedAt: null },
      include: {
        client: { select: { id: true, name: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Write — create
  // ---------------------------------------------------------------------------

  async create(createAssetDto: CreateAssetDto) {
    const createData: any = {
      name: createAssetDto.name,
      type: createAssetDto.type,
      clientId: createAssetDto.clientId,
      metadata: (createAssetDto.metadata || {}) as Record<string, any>,
    };
    if ((createAssetDto as any).organizationId !== undefined) {
      createData.organizationId = (createAssetDto as any).organizationId;
    }
    if (createAssetDto.description !== undefined)
      createData.description = createAssetDto.description;
    if (
      createAssetDto.renewalDate !== undefined &&
      createAssetDto.renewalDate !== null
    ) {
      const d = new Date(createAssetDto.renewalDate);
      if (!isNaN(d.getTime())) createData.renewalDate = d;
    }
    if (
      createAssetDto.cost !== undefined &&
      createAssetDto.cost !== null &&
      !isNaN(Number(createAssetDto.cost))
    ) {
      createData.cost = Number(createAssetDto.cost);
    }
    if (createAssetDto.billingCycle !== undefined)
      createData.billingCycle = createAssetDto.billingCycle;
    if (createAssetDto.notes !== undefined)
      createData.notes = createAssetDto.notes;

    if (createAssetDto.guardianMode) {
      const mode = String(createAssetDto.guardianMode).toUpperCase();
      if (['MANAGED', 'BYOVPS'].includes(mode))
        createData.guardianMode = mode as any;
    }
    if (createAssetDto.guardianOwnership) {
      const ownership = String(createAssetDto.guardianOwnership).toUpperCase();
      if (['NEURAVOLT', 'CLIENT'].includes(ownership))
        createData.guardianOwnership = ownership as any;
    }

    return this.prisma.asset.create({
      data: createData,
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Write — update
  // ---------------------------------------------------------------------------

  async update(id: string, updateAssetDto: UpdateAssetDto) {
    const existing = await this.findById(id);

    const mergedMetadata: Record<string, any> = {
      ...((existing?.metadata as any) || {}),
      ...(updateAssetDto.metadata || {}),
    };

    const updateData: any = {};
    if (updateAssetDto.name !== undefined)
      updateData.name = updateAssetDto.name;
    if (updateAssetDto.type !== undefined)
      updateData.type = updateAssetDto.type;
    if (updateAssetDto.clientId !== undefined)
      updateData.clientId = updateAssetDto.clientId;
    if (updateAssetDto.description !== undefined)
      updateData.description = updateAssetDto.description;
    if (updateAssetDto.renewalDate !== undefined) {
      if (updateAssetDto.renewalDate === null) {
        updateData.renewalDate = null;
      } else {
        const d = new Date(updateAssetDto.renewalDate);
        if (!isNaN(d.getTime())) updateData.renewalDate = d;
      }
    }
    if (
      updateAssetDto.cost !== undefined &&
      updateAssetDto.cost !== null &&
      !isNaN(Number(updateAssetDto.cost))
    ) {
      updateData.cost = Number(updateAssetDto.cost);
    }
    if (updateAssetDto.billingCycle !== undefined)
      updateData.billingCycle = updateAssetDto.billingCycle;
    if (updateAssetDto.notes !== undefined)
      updateData.notes = updateAssetDto.notes;

    if (
      updateAssetDto.guardianMode !== undefined &&
      updateAssetDto.guardianMode !== null
    ) {
      const mode = String(updateAssetDto.guardianMode).toUpperCase();
      if (['MANAGED', 'BYOVPS'].includes(mode))
        updateData.guardianMode = mode as any;
    }
    if (
      updateAssetDto.guardianOwnership !== undefined &&
      updateAssetDto.guardianOwnership !== null
    ) {
      const ownership = String(updateAssetDto.guardianOwnership).toUpperCase();
      if (['NEURAVOLT', 'CLIENT'].includes(ownership))
        updateData.guardianOwnership = ownership as any;
    }

    updateData.metadata = mergedMetadata;

    return this.prisma.asset.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Write — soft delete / restore
  // ---------------------------------------------------------------------------

  async softDelete(id: string) {
    return this.prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    return this.prisma.asset.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  // ---------------------------------------------------------------------------
  // Read — upcoming renewals / expired
  // ---------------------------------------------------------------------------

  async findUpcomingRenewals(daysThreshold: number = 30, organizationId?: string) {
    const where: any = {
      deletedAt: null,
      renewalDate: {
        lte: new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000),
        gte: new Date(),
      },
    };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.prisma.asset.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
      },
    });
  }

  async findExpiredAssets(organizationId?: string) {
    const where: any = {
      deletedAt: null,
      renewalDate: {
        lt: new Date(),
      },
    };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.prisma.asset.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
      },
    });
  }
}
