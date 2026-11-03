import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPlan(dto: CreatePlanDto) {
    const trimmedSlug = dto.slug.trim().toLowerCase();
    const trimmedName = dto.name.trim();

    if (!trimmedSlug || !trimmedName) {
      throw new BadRequestException('Plan name and slug are required');
    }

    const existing = await this.prisma.plan.findFirst({
      where: {
        OR: [{ slug: trimmedSlug }, { name: trimmedName }],
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `A plan with name "${trimmedName}" or slug "${trimmedSlug}" already exists`,
      );
    }

    return this.prisma.plan.create({
      data: {
        name: trimmedName,
        slug: trimmedSlug,
        description: dto.description?.trim() || null,
        priceMonthlyINR: dto.priceMonthlyINR ?? 0,
        priceYearlyINR: dto.priceYearlyINR ?? 0,
        priceMonthlyUSD: dto.priceMonthlyUSD ?? 0,
        priceYearlyUSD: dto.priceYearlyUSD ?? 0,
        maxMembers: dto.maxMembers ?? 5,
        maxProjects: dto.maxProjects ?? 10,
        maxServers: dto.maxServers ?? 1,
        featureProjectsTasks: dto.featureProjectsTasks ?? true,
        featureCrm: dto.featureCrm ?? true,
        featureBilling: dto.featureBilling ?? true,
        featureGuardianByovps: dto.featureGuardianByovps ?? false,
        featureClientPortal: dto.featureClientPortal ?? false,
        featureApiAccess: dto.featureApiAccess ?? false,
        isPublic: dto.isPublic ?? true,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async listAllPlans(includeInactive = true) {
    const where: any = { deletedAt: null };
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.plan.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getPublicPlans() {
    return this.prisma.plan.findMany({
      where: {
        isActive: true,
        isPublic: true,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getPlanById(id: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id, deletedAt: null },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID "${id}" not found`);
    }

    return plan;
  }

  async getPlanBySlug(slug: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { slug: slug.trim().toLowerCase(), deletedAt: null },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with slug "${slug}" not found`);
    }

    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    await this.getPlanById(id);

    if (dto.name || dto.slug) {
      const conflict = await this.prisma.plan.findFirst({
        where: {
          id: { not: id },
          deletedAt: null,
          OR: [
            ...(dto.name ? [{ name: dto.name.trim() }] : []),
            ...(dto.slug ? [{ slug: dto.slug.trim().toLowerCase() }] : []),
          ],
        },
      });

      if (conflict) {
        throw new ConflictException(
          'Another plan with the requested name or slug already exists',
        );
      }
    }

    return this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.slug !== undefined && { slug: dto.slug.trim().toLowerCase() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() || null,
        }),
        ...(dto.priceMonthlyINR !== undefined && {
          priceMonthlyINR: dto.priceMonthlyINR,
        }),
        ...(dto.priceYearlyINR !== undefined && {
          priceYearlyINR: dto.priceYearlyINR,
        }),
        ...(dto.priceMonthlyUSD !== undefined && {
          priceMonthlyUSD: dto.priceMonthlyUSD,
        }),
        ...(dto.priceYearlyUSD !== undefined && {
          priceYearlyUSD: dto.priceYearlyUSD,
        }),
        ...(dto.maxMembers !== undefined && { maxMembers: dto.maxMembers }),
        ...(dto.maxProjects !== undefined && { maxProjects: dto.maxProjects }),
        ...(dto.maxServers !== undefined && { maxServers: dto.maxServers }),
        ...(dto.featureProjectsTasks !== undefined && {
          featureProjectsTasks: dto.featureProjectsTasks,
        }),
        ...(dto.featureCrm !== undefined && { featureCrm: dto.featureCrm }),
        ...(dto.featureBilling !== undefined && {
          featureBilling: dto.featureBilling,
        }),
        ...(dto.featureGuardianByovps !== undefined && {
          featureGuardianByovps: dto.featureGuardianByovps,
        }),
        ...(dto.featureClientPortal !== undefined && {
          featureClientPortal: dto.featureClientPortal,
        }),
        ...(dto.featureApiAccess !== undefined && {
          featureApiAccess: dto.featureApiAccess,
        }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deactivatePlan(id: string) {
    await this.getPlanById(id);

    return this.prisma.plan.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
