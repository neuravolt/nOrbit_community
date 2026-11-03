import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from '../subscriptions.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      organizationSubscription: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      plan: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      organizationMember: {
        count: jest.fn(),
      },
      organizationInvitation: {
        count: jest.fn(),
      },
      project: {
        count: jest.fn(),
      },
      asset: {
        count: jest.fn(),
      },
      client: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('getOrganizationSubscription', () => {
    it('returns subscription, plan, usage, and effective limits', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'Acme Corp',
      });
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        planId: 'plan-pro',
        status: 'ACTIVE',
        billingInterval: 'MONTHLY',
        currency: 'INR',
        customMaxMembers: 20,
        customMaxProjects: null,
        customMaxServers: null,
        plan: {
          id: 'plan-pro',
          name: 'Pro',
          slug: 'pro',
          maxMembers: 15,
          maxProjects: 50,
          maxServers: 5,
        },
      });

      prisma.organizationMember.count.mockResolvedValue(5);
      prisma.organizationInvitation.count.mockResolvedValue(2);
      prisma.project.count.mockResolvedValue(8);
      prisma.asset.count.mockResolvedValue(3);

      const result = await service.getOrganizationSubscription('org-1');

      expect(result.subscription.planName).toBe('Pro');
      expect(result.usage.members).toBe(7); // 5 members + 2 invitations
      expect(result.usage.effectiveMaxMembers).toBe(20); // custom override
      expect(result.usage.effectiveMaxProjects).toBe(50);
      expect(result.usage.effectiveMaxServers).toBe(5);
    });

    it('throws NotFoundException if organization does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrganizationSubscription('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSubscription', () => {
    it('updates subscription with custom limit overrides and expiry', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
      prisma.plan.findFirst.mockResolvedValue({ id: 'plan-enterprise' });
      prisma.organizationSubscription.upsert.mockResolvedValue({
        id: 'sub-1',
        planId: 'plan-enterprise',
        customMaxMembers: 50,
        customMaxServers: 20,
        status: 'ACTIVE',
        expiresAt: new Date('2027-12-31'),
      });

      const result = await service.updateSubscription('org-1', {
        planId: 'plan-enterprise',
        customMaxMembers: 50,
        customMaxServers: 20,
        expiresAt: '2027-12-31T00:00:00.000Z',
      });

      expect(result.customMaxMembers).toBe(50);
      expect(result.customMaxServers).toBe(20);
      expect(prisma.organizationSubscription.upsert).toHaveBeenCalled();
    });
  });

  describe('initiateUpgrade', () => {
    it('creates an upgrade invoice and returns checkout URL', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'Acme Corp',
      });
      prisma.plan.findFirst.mockResolvedValue({
        id: 'plan-pro',
        name: 'Pro',
        priceMonthlyINR: 2999,
        priceYearlyINR: 29990,
        priceMonthlyUSD: 39,
        priceYearlyUSD: 390,
      });

      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.invoice.create.mockResolvedValue({
        id: 'inv-123',
        invoiceNumber: 'INV-SUB-12345',
      });

      const result = await service.initiateUpgrade('org-1', 'user-1', {
        planId: 'plan-pro',
        billingInterval: 'MONTHLY',
        currency: 'INR',
      });

      expect(result).toEqual({
        invoiceId: 'inv-123',
        invoiceNumber: 'INV-SUB-12345',
        amount: 2999,
        currency: 'INR',
        checkoutUrl: '/pay/inv-123',
        planName: 'Pro',
        billingInterval: 'MONTHLY',
      });
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            clientId: 'client-1',
            totalAmount: 2999,
          }),
        }),
      );
    });
  });
});
