import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface LimitExceededPayload {
  code: 'LIMIT_EXCEEDED';
  resource: 'members' | 'projects' | 'servers';
  limit: number;
  current: number;
  message: string;
}

@Injectable()
export class PlansEnforcementService {
  private readonly logger = new Logger(PlansEnforcementService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getSubscriptionAndPlan(organizationId: string) {
    let sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (!sub) {
      let starterPlan = await this.prisma.plan.findFirst({
        where: { slug: 'starter', deletedAt: null },
      });

      if (!starterPlan) {
        starterPlan = await this.prisma.plan.findFirst({
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        });
      }

      if (starterPlan) {
        sub = await this.prisma.organizationSubscription.upsert({
          where: { organizationId },
          create: {
            organizationId,
            planId: starterPlan.id,
            status: 'ACTIVE',
            billingInterval: 'MONTHLY',
            currency: 'INR',
          },
          update: {},
          include: { plan: true },
        });
      }
    }

    return sub;
  }

  async getEffectiveLimits(organizationId: string) {
    const sub = await this.getSubscriptionAndPlan(organizationId);

    const defaultLimits = {
      maxMembers: 5,
      maxProjects: 10,
      maxServers: 1,
    };

    if (!sub || !sub.plan) {
      return defaultLimits;
    }

    const resolveLimit = (
      custom: number | null | undefined,
      planLimit: number,
    ) => {
      if (custom !== null && custom !== undefined) {
        return custom <= 0 || custom === -1 ? -1 : custom;
      }
      return planLimit <= 0 || planLimit === -1 ? -1 : planLimit;
    };

    return {
      maxMembers: resolveLimit(sub.customMaxMembers, sub.plan.maxMembers),
      maxProjects: resolveLimit(sub.customMaxProjects, sub.plan.maxProjects),
      maxServers: resolveLimit(sub.customMaxServers, sub.plan.maxServers),
    };
  }

  async assertCanInviteMember(organizationId: string): Promise<void> {
    if (!organizationId) return;

    const limits = await this.getEffectiveLimits(organizationId);
    if (limits.maxMembers === -1) {
      return; // Unlimited
    }

    const [membersCount, pendingInvitesCount] = await Promise.all([
      this.prisma.organizationMember.count({
        where: { organizationId },
      }),
      this.prisma.organizationInvitation.count({
        where: { organizationId, status: 'PENDING' },
      }),
    ]);

    const currentCount = membersCount + pendingInvitesCount;

    if (currentCount >= limits.maxMembers) {
      this.logger.warn(
        `Quota exceeded for org ${organizationId}: members (${currentCount}/${limits.maxMembers})`,
      );
      throw new ForbiddenException({
        code: 'LIMIT_EXCEEDED',
        resource: 'members',
        limit: limits.maxMembers,
        current: currentCount,
        message:
          'Organization member limit reached. Please upgrade your subscription plan to invite more members.',
      });
    }
  }

  async assertCanCreateProject(organizationId: string): Promise<void> {
    if (!organizationId) return;

    const limits = await this.getEffectiveLimits(organizationId);
    if (limits.maxProjects === -1) {
      return; // Unlimited
    }

    const currentProjectsCount = await this.prisma.project.count({
      where: {
        organizationId,
        deletedAt: null,
      },
    });

    if (currentProjectsCount >= limits.maxProjects) {
      this.logger.warn(
        `Quota exceeded for org ${organizationId}: projects (${currentProjectsCount}/${limits.maxProjects})`,
      );
      throw new ForbiddenException({
        code: 'LIMIT_EXCEEDED',
        resource: 'projects',
        limit: limits.maxProjects,
        current: currentProjectsCount,
        message:
          'Organization project limit reached. Please upgrade your subscription plan to create more projects.',
      });
    }
  }

  async assertCanAttachServer(organizationId: string): Promise<void> {
    if (!organizationId) return;

    const limits = await this.getEffectiveLimits(organizationId);
    if (limits.maxServers === -1) {
      return; // Unlimited
    }

    const currentServersCount = await this.prisma.asset.count({
      where: {
        organizationId,
        deletedAt: null,
        OR: [{ type: 'VPS' }, { guardianMode: 'BYOVPS' }],
      },
    });

    if (currentServersCount >= limits.maxServers) {
      this.logger.warn(
        `Quota exceeded for org ${organizationId}: servers (${currentServersCount}/${limits.maxServers})`,
      );
      throw new ForbiddenException({
        code: 'LIMIT_EXCEEDED',
        resource: 'servers',
        limit: limits.maxServers,
        current: currentServersCount,
        message:
          'Organization server limit reached. Please upgrade your subscription plan to attach more BYOVPS servers.',
      });
    }
  }
}
