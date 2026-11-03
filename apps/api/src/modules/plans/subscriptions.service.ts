import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AssignSubscriptionDto, UpgradePlanDto } from './dto';
import * as crypto from 'crypto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateDefaultStarterPlan() {
    let starterPlan = await this.prisma.plan.findFirst({
      where: { slug: 'starter', deletedAt: null },
    });

    if (!starterPlan) {
      starterPlan = await this.prisma.plan.create({
        data: {
          name: 'Starter',
          slug: 'starter',
          description: 'Default Starter Plan',
          priceMonthlyINR: 999,
          priceYearlyINR: 9990,
          priceMonthlyUSD: 15,
          priceYearlyUSD: 150,
          maxMembers: 5,
          maxProjects: 10,
          maxServers: 1,
          isPublic: true,
          isActive: true,
          sortOrder: 1,
        },
      });
    }

    return starterPlan;
  }

  async getOrganizationSubscription(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException(`Organization "${organizationId}" not found`);
    }

    let sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (!sub) {
      const starterPlan = await this.getOrCreateDefaultStarterPlan();
      sub = await this.prisma.organizationSubscription.create({
        data: {
          organizationId,
          planId: starterPlan.id,
          status: 'ACTIVE',
          billingInterval: 'MONTHLY',
          currency: 'INR',
        },
        include: { plan: true },
      });
    }

    const [memberCount, inviteCount, projectCount, serverCount] =
      await Promise.all([
        this.prisma.organizationMember.count({
          where: { organizationId },
        }),
        this.prisma.organizationInvitation.count({
          where: { organizationId, status: 'PENDING' },
        }),
        this.prisma.project.count({
          where: { organizationId, deletedAt: null },
        }),
        this.prisma.asset.count({
          where: {
            organizationId,
            deletedAt: null,
            OR: [{ type: 'VPS' }, { guardianMode: 'BYOVPS' }],
          },
        }),
      ]);

    const effectiveMaxMembers =
      sub.customMaxMembers !== null && sub.customMaxMembers !== undefined
        ? sub.customMaxMembers
        : sub.plan.maxMembers;

    const effectiveMaxProjects =
      sub.customMaxProjects !== null && sub.customMaxProjects !== undefined
        ? sub.customMaxProjects
        : sub.plan.maxProjects;

    const effectiveMaxServers =
      sub.customMaxServers !== null && sub.customMaxServers !== undefined
        ? sub.customMaxServers
        : sub.plan.maxServers;

    return {
      organization: {
        id: org.id,
        name: org.name,
        domain: org.domain,
      },
      subscription: {
        id: sub.id,
        planId: sub.planId,
        planName: sub.plan.name,
        planSlug: sub.plan.slug,
        status: sub.status,
        billingInterval: sub.billingInterval,
        currency: sub.currency,
        customMaxMembers: sub.customMaxMembers,
        customMaxProjects: sub.customMaxProjects,
        customMaxServers: sub.customMaxServers,
        expiresAt: sub.expiresAt,
        trialExpiresAt: sub.trialExpiresAt,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      },
      plan: sub.plan,
      usage: {
        members: memberCount + inviteCount,
        activeMembers: memberCount,
        pendingInvitations: inviteCount,
        effectiveMaxMembers,
        projects: projectCount,
        effectiveMaxProjects,
        servers: serverCount,
        effectiveMaxServers,
      },
      effectiveLimits: {
        maxMembers: effectiveMaxMembers,
        maxProjects: effectiveMaxProjects,
        maxServers: effectiveMaxServers,
      },
    };
  }

  async listOrganizationsWithSubscriptions(query?: {
    search?: string;
    planId?: string;
  }) {
    const where: any = {};
    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { domain: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orgs = await this.prisma.organization.findMany({
      where,
      include: {
        subscription: {
          include: { plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const defaultPlan = await this.getOrCreateDefaultStarterPlan();

    const results = await Promise.all(
      orgs.map(async (org) => {
        const sub = org.subscription;
        const currentPlan = sub?.plan || defaultPlan;

        const [memberCount, inviteCount, projectCount, serverCount] =
          await Promise.all([
            this.prisma.organizationMember.count({
              where: { organizationId: org.id },
            }),
            this.prisma.organizationInvitation.count({
              where: { organizationId: org.id, status: 'PENDING' },
            }),
            this.prisma.project.count({
              where: { organizationId: org.id, deletedAt: null },
            }),
            this.prisma.asset.count({
              where: {
                organizationId: org.id,
                deletedAt: null,
                OR: [{ type: 'VPS' }, { guardianMode: 'BYOVPS' }],
              },
            }),
          ]);

        const effectiveMaxMembers =
          sub?.customMaxMembers !== null && sub?.customMaxMembers !== undefined
            ? sub.customMaxMembers
            : currentPlan.maxMembers;

        const effectiveMaxProjects =
          sub?.customMaxProjects !== null &&
          sub?.customMaxProjects !== undefined
            ? sub.customMaxProjects
            : currentPlan.maxProjects;

        const effectiveMaxServers =
          sub?.customMaxServers !== null && sub?.customMaxServers !== undefined
            ? sub.customMaxServers
            : currentPlan.maxServers;

        return {
          id: org.id,
          name: org.name,
          domain: org.domain,
          createdAt: org.createdAt,
          subscription: {
            id: sub?.id || null,
            planId: currentPlan.id,
            planName: currentPlan.name,
            planSlug: currentPlan.slug,
            status: sub?.status || 'ACTIVE',
            billingInterval: sub?.billingInterval || 'MONTHLY',
            currency: sub?.currency || 'INR',
            customMaxMembers: sub?.customMaxMembers ?? null,
            customMaxProjects: sub?.customMaxProjects ?? null,
            customMaxServers: sub?.customMaxServers ?? null,
            expiresAt: sub?.expiresAt ?? null,
            trialExpiresAt: sub?.trialExpiresAt ?? null,
          },
          usage: {
            members: memberCount + inviteCount,
            activeMembers: memberCount,
            pendingInvitations: inviteCount,
            effectiveMaxMembers,
            projects: projectCount,
            effectiveMaxProjects,
            servers: serverCount,
            effectiveMaxServers,
          },
        };
      }),
    );

    if (query?.planId) {
      return results.filter((r) => r.subscription.planId === query.planId);
    }

    return results;
  }

  async updateSubscription(organizationId: string, dto: AssignSubscriptionDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException(`Organization "${organizationId}" not found`);
    }

    if (dto.planId) {
      const plan = await this.prisma.plan.findFirst({
        where: { id: dto.planId, deletedAt: null },
      });
      if (!plan) {
        throw new NotFoundException(`Plan "${dto.planId}" not found`);
      }
    }

    const defaultPlan = await this.getOrCreateDefaultStarterPlan();
    const targetPlanId = dto.planId || defaultPlan.id;

    return this.prisma.organizationSubscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planId: targetPlanId,
        status: dto.status || 'ACTIVE',
        billingInterval: dto.billingInterval || 'MONTHLY',
        currency: dto.currency || 'INR',
        customMaxMembers:
          dto.customMaxMembers !== undefined ? dto.customMaxMembers : null,
        customMaxProjects:
          dto.customMaxProjects !== undefined ? dto.customMaxProjects : null,
        customMaxServers:
          dto.customMaxServers !== undefined ? dto.customMaxServers : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        trialExpiresAt: dto.trialExpiresAt
          ? new Date(dto.trialExpiresAt)
          : null,
      },
      update: {
        ...(dto.planId && { planId: dto.planId }),
        ...(dto.status && { status: dto.status }),
        ...(dto.billingInterval && { billingInterval: dto.billingInterval }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.customMaxMembers !== undefined && {
          customMaxMembers: dto.customMaxMembers,
        }),
        ...(dto.customMaxProjects !== undefined && {
          customMaxProjects: dto.customMaxProjects,
        }),
        ...(dto.customMaxServers !== undefined && {
          customMaxServers: dto.customMaxServers,
        }),
        ...(dto.expiresAt !== undefined && {
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        }),
        ...(dto.trialExpiresAt !== undefined && {
          trialExpiresAt: dto.trialExpiresAt
            ? new Date(dto.trialExpiresAt)
            : null,
        }),
      },
      include: { plan: true },
    });
  }

  async initiateUpgrade(
    organizationId: string,
    userId: string,
    dto: UpgradePlanDto,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException(`Organization "${organizationId}" not found`);
    }

    const targetPlan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, deletedAt: null, isActive: true },
    });

    if (!targetPlan) {
      throw new NotFoundException(`Plan "${dto.planId}" not found or inactive`);
    }

    const interval = dto.billingInterval || 'MONTHLY';
    const currency = dto.currency || 'INR';

    let amount = 0;
    if (currency === 'USD') {
      amount =
        interval === 'YEARLY'
          ? targetPlan.priceYearlyUSD
          : targetPlan.priceMonthlyUSD;
    } else {
      amount =
        interval === 'YEARLY'
          ? targetPlan.priceYearlyINR
          : targetPlan.priceMonthlyINR;
    }

    // Ensure a client record exists for this organization to link the invoice
    let client = await this.prisma.client.findFirst({
      where: { organizationId, deletedAt: null },
    });

    if (!client) {
      client = await this.prisma.client.create({
        data: {
          name: org.name,
          email: `${(org.domain || org.name).toLowerCase().replace(/[^a-z0-9]/g, '')}@organization.local`,
          organizationId,
          status: 'ACTIVE',
        },
      });
    }

    // Generate invoice
    const invoiceNumber = `INV-SUB-${Date.now().toString(36).toUpperCase()}`;
    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        status: 'SENT',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        clientId: client.id,
        organizationId,
        subTotal: amount,
        taxAmount: 0,
        totalAmount: amount,
        grandTotal: amount,
        amountPaid: 0,
        balanceDue: amount,
        notes: `Subscription upgrade to ${targetPlan.name} (${interval}) - Currency: ${currency}`,
        lineItems: {
          create: {
            description: `nORBIT SaaS Subscription - ${targetPlan.name} Plan (${interval})`,
            quantity: 1,
            unitPrice: amount,
            amount: amount,
          },
        },
      },
    });

    // If free (e.g. 0 amount), automatically switch plan
    if (amount <= 0) {
      await this.prisma.organizationSubscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          planId: targetPlan.id,
          status: 'ACTIVE',
          billingInterval: interval,
          currency,
        },
        update: {
          planId: targetPlan.id,
          status: 'ACTIVE',
          billingInterval: interval,
          currency,
        },
      });
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount,
      currency,
      checkoutUrl: `/pay/${invoice.id}`,
      planName: targetPlan.name,
      billingInterval: interval,
    };
  }
}
