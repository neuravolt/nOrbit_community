import { Test, TestingModule } from '@nestjs/testing';
import { PlansEnforcementService } from '../plans-enforcement.service';
import { PlansService } from '../plans.service';
import { SubscriptionsService } from '../subscriptions.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { ProjectsService } from '../../projects/projects.service';
import { AssetsService } from '../../assets/assets.service';
import { GuardianController } from '../../guardian/guardian.controller';
import { GuardianService } from '../../guardian/guardian.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ProjectsRepository } from '../../projects/projects.repository';
import { OrganizationRole } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Empirical Adversarial Challenge Suite: Dynamic Plans & Quotas', () => {
  let enforcementService: PlansEnforcementService;
  let plansService: PlansService;
  let subscriptionsService: SubscriptionsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      organizationSubscription: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
      },
      plan: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organizationMember: {
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      organizationInvitation: {
        count: jest.fn(),
        create: jest.fn(),
      },
      project: {
        count: jest.fn(),
      },
      asset: {
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      client: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansEnforcementService,
        PlansService,
        SubscriptionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    enforcementService = module.get<PlansEnforcementService>(
      PlansEnforcementService,
    );
    plansService = module.get<PlansService>(PlansService);
    subscriptionsService =
      module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('Adversarial Challenge 1: Quota Limits (Members, Projects, Servers)', () => {
    // 1.1 Members
    it('blocks member invitation when currentCount == limit (boundary)', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: 5 },
        customMaxMembers: null,
      });
      prisma.organizationMember.count.mockResolvedValue(4);
      prisma.organizationInvitation.count.mockResolvedValue(1); // 4 + 1 = 5 == limit

      await expect(
        enforcementService.assertCanInviteMember('org-test'),
      ).rejects.toThrow(ForbiddenException);

      try {
        await enforcementService.assertCanInviteMember('org-test');
      } catch (err: any) {
        const payload = err.getResponse();
        expect(payload).toEqual({
          code: 'LIMIT_EXCEEDED',
          resource: 'members',
          limit: 5,
          current: 5,
          message:
            'Organization member limit reached. Please upgrade your subscription plan to invite more members.',
        });
      }
    });

    it('blocks member invitation when currentCount > limit (oversubscribed)', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: 5 },
        customMaxMembers: null,
      });
      prisma.organizationMember.count.mockResolvedValue(5);
      prisma.organizationInvitation.count.mockResolvedValue(3); // 8 > 5

      await expect(
        enforcementService.assertCanInviteMember('org-test'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows member invitation when currentCount == limit - 1 (within capacity)', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: 5 },
        customMaxMembers: null,
      });
      prisma.organizationMember.count.mockResolvedValue(3);
      prisma.organizationInvitation.count.mockResolvedValue(1); // 3 + 1 = 4 < 5

      await expect(
        enforcementService.assertCanInviteMember('org-test'),
      ).resolves.not.toThrow();
    });

    // 1.2 Projects
    it('blocks project creation when currentCount == maxProjects (boundary)', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxProjects: 10 },
        customMaxProjects: null,
      });
      prisma.project.count.mockResolvedValue(10); // 10 == 10

      await expect(
        enforcementService.assertCanCreateProject('org-test'),
      ).rejects.toThrow(ForbiddenException);

      try {
        await enforcementService.assertCanCreateProject('org-test');
      } catch (err: any) {
        const payload = err.getResponse();
        expect(payload).toEqual({
          code: 'LIMIT_EXCEEDED',
          resource: 'projects',
          limit: 10,
          current: 10,
          message:
            'Organization project limit reached. Please upgrade your subscription plan to create more projects.',
        });
      }
    });

    it('allows project creation when currentCount == maxProjects - 1', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxProjects: 10 },
        customMaxProjects: null,
      });
      prisma.project.count.mockResolvedValue(9);

      await expect(
        enforcementService.assertCanCreateProject('org-test'),
      ).resolves.not.toThrow();
    });

    // 1.3 Servers
    it('blocks BYOVPS server attachment when currentCount == maxServers (boundary)', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxServers: 2 },
        customMaxServers: null,
      });
      prisma.asset.count.mockResolvedValue(2); // 2 == 2

      await expect(
        enforcementService.assertCanAttachServer('org-test'),
      ).rejects.toThrow(ForbiddenException);

      try {
        await enforcementService.assertCanAttachServer('org-test');
      } catch (err: any) {
        const payload = err.getResponse();
        expect(payload).toEqual({
          code: 'LIMIT_EXCEEDED',
          resource: 'servers',
          limit: 2,
          current: 2,
          message:
            'Organization server limit reached. Please upgrade your subscription plan to attach more BYOVPS servers.',
        });
      }
    });

    it('allows server attachment when currentCount < maxServers', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxServers: 2 },
        customMaxServers: null,
      });
      prisma.asset.count.mockResolvedValue(1);

      await expect(
        enforcementService.assertCanAttachServer('org-test'),
      ).resolves.not.toThrow();
    });
  });

  describe('Adversarial Challenge 2: Custom Overrides Precedence', () => {
    it('customMaxMembers override takes precedence when higher than plan limit', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: 5 },
        customMaxMembers: 15, // Custom override allows 15
      });
      prisma.organizationMember.count.mockResolvedValue(6);
      prisma.organizationInvitation.count.mockResolvedValue(0);

      // 6 > 5 (plan limit), but 6 < 15 (custom limit) => must succeed
      await expect(
        enforcementService.assertCanInviteMember('org-test'),
      ).resolves.not.toThrow();

      // At custom limit 15 => must block
      prisma.organizationMember.count.mockResolvedValue(10);
      prisma.organizationInvitation.count.mockResolvedValue(5); // 15 == 15
      await expect(
        enforcementService.assertCanInviteMember('org-test'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('customMaxMembers override can restrict below plan limit', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: 50 },
        customMaxMembers: 3, // Custom override restricts to 3
      });
      prisma.organizationMember.count.mockResolvedValue(3);
      prisma.organizationInvitation.count.mockResolvedValue(0);

      // 3 < 50 (plan limit), but 3 == 3 (custom limit) => must block
      await expect(
        enforcementService.assertCanInviteMember('org-test'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('customMaxProjects override takes precedence over plan default', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxProjects: 10 },
        customMaxProjects: 25,
      });
      prisma.project.count.mockResolvedValue(15);

      // 15 > 10, but 15 < 25 => must succeed
      await expect(
        enforcementService.assertCanCreateProject('org-test'),
      ).resolves.not.toThrow();

      // At 25 => must block
      prisma.project.count.mockResolvedValue(25);
      await expect(
        enforcementService.assertCanCreateProject('org-test'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('customMaxServers override takes precedence over plan default', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxServers: 1 },
        customMaxServers: 8,
      });
      prisma.asset.count.mockResolvedValue(5);

      // 5 > 1, but 5 < 8 => must succeed
      await expect(
        enforcementService.assertCanAttachServer('org-test'),
      ).resolves.not.toThrow();

      // At 8 => must block
      prisma.asset.count.mockResolvedValue(8);
      await expect(
        enforcementService.assertCanAttachServer('org-test'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Adversarial Challenge 3: Unlimited Semantics (-1 and <= 0)', () => {
    it('plan limits set to -1 are treated as unlimited without error or limit check', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: -1, maxProjects: -1, maxServers: -1 },
        customMaxMembers: null,
        customMaxProjects: null,
        customMaxServers: null,
      });
      prisma.organizationMember.count.mockResolvedValue(99999);
      prisma.organizationInvitation.count.mockResolvedValue(10000);
      prisma.project.count.mockResolvedValue(50000);
      prisma.asset.count.mockResolvedValue(20000);

      await expect(
        enforcementService.assertCanInviteMember('org-unlimited'),
      ).resolves.not.toThrow();
      await expect(
        enforcementService.assertCanCreateProject('org-unlimited'),
      ).resolves.not.toThrow();
      await expect(
        enforcementService.assertCanAttachServer('org-unlimited'),
      ).resolves.not.toThrow();

      // Verify count was not even queried for members/projects/servers because limit is -1
      expect(prisma.organizationMember.count).not.toHaveBeenCalled();
      expect(prisma.project.count).not.toHaveBeenCalled();
      expect(prisma.asset.count).not.toHaveBeenCalled();
    });

    it('plan limits set to 0 or negative values are treated as unlimited', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: 0, maxProjects: -5, maxServers: 0 },
        customMaxMembers: null,
        customMaxProjects: null,
        customMaxServers: null,
      });

      await expect(
        enforcementService.assertCanInviteMember('org-unlimited'),
      ).resolves.not.toThrow();
      await expect(
        enforcementService.assertCanCreateProject('org-unlimited'),
      ).resolves.not.toThrow();
      await expect(
        enforcementService.assertCanAttachServer('org-unlimited'),
      ).resolves.not.toThrow();
    });

    it('custom overrides set to -1 or 0 override bounded plan limits with unlimited', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: 5, maxProjects: 10, maxServers: 1 },
        customMaxMembers: -1,
        customMaxProjects: 0,
        customMaxServers: -1,
      });

      // Even with large counts, unlimited override bypasses counting and checks
      await expect(
        enforcementService.assertCanInviteMember('org-unlimited'),
      ).resolves.not.toThrow();
      await expect(
        enforcementService.assertCanCreateProject('org-unlimited'),
      ).resolves.not.toThrow();
      await expect(
        enforcementService.assertCanAttachServer('org-unlimited'),
      ).resolves.not.toThrow();
    });
  });

  describe('Adversarial Challenge 4: Public Plan Listing & Inactive Filtering', () => {
    it('getPublicPlans strictly filters out inactive and private plans', async () => {
      await plansService.getPublicPlans();

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          isPublic: true,
          deletedAt: null,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('verifies that listAllPlans(false) filters out inactive plans', async () => {
      await plansService.listAllPlans(false);

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('Adversarial Challenge 5: Upgrade Flow & Invoice Generation', () => {
    it('creates a pending SENT invoice linked to the organization and client on upgrade', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-test-123',
        name: 'Enterprise Corp',
        domain: 'enterprise.com',
      });

      prisma.plan.findFirst.mockResolvedValue({
        id: 'plan-enterprise-tier',
        name: 'Enterprise',
        priceMonthlyINR: 9999,
        priceYearlyINR: 99990,
        priceMonthlyUSD: 129,
        priceYearlyUSD: 1290,
        isActive: true,
      });

      prisma.client.findFirst.mockResolvedValue({
        id: 'client-linked-456',
        organizationId: 'org-test-123',
      });

      prisma.invoice.create.mockResolvedValue({
        id: 'inv-generated-789',
        invoiceNumber: 'INV-SUB-TEST1',
        status: 'SENT',
      });

      const upgradeResult = await subscriptionsService.initiateUpgrade(
        'org-test-123',
        'user-admin-1',
        {
          planId: 'plan-enterprise-tier',
          billingInterval: 'YEARLY',
          currency: 'INR',
        },
      );

      // Verify returned checkout details
      expect(upgradeResult).toEqual({
        invoiceId: 'inv-generated-789',
        invoiceNumber: 'INV-SUB-TEST1',
        amount: 99990,
        currency: 'INR',
        checkoutUrl: '/pay/inv-generated-789',
        planName: 'Enterprise',
        billingInterval: 'YEARLY',
      });

      // Verify invoice was created with correct organization linkage and SENT status
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-test-123',
            clientId: 'client-linked-456',
            status: 'SENT',
            subTotal: 99990,
            grandTotal: 99990,
            balanceDue: 99990,
            amountPaid: 0,
            notes: expect.stringContaining(
              'Enterprise (YEARLY) - Currency: INR',
            ),
            lineItems: {
              create: expect.objectContaining({
                amount: 99990,
                unitPrice: 99990,
                quantity: 1,
              }),
            },
          }),
        }),
      );
    });

    it('rejects upgrade to inactive or deleted plan with NotFoundException', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-test-123' });
      prisma.plan.findFirst.mockResolvedValue(null); // inactive or deleted

      await expect(
        subscriptionsService.initiateUpgrade('org-test-123', 'user-admin-1', {
          planId: 'inactive-plan',
          billingInterval: 'MONTHLY',
          currency: 'USD',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('automatically activates subscription without invoice checkout if target plan price is 0', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-free-123',
        name: 'Free Org',
      });

      prisma.plan.findFirst.mockResolvedValue({
        id: 'plan-free',
        name: 'Free Plan',
        priceMonthlyINR: 0,
        priceYearlyINR: 0,
        priceMonthlyUSD: 0,
        priceYearlyUSD: 0,
        isActive: true,
      });

      prisma.client.findFirst.mockResolvedValue({ id: 'client-free' });
      prisma.invoice.create.mockResolvedValue({
        id: 'inv-free-1',
        invoiceNumber: 'INV-SUB-FREE',
      });
      prisma.organizationSubscription.upsert.mockResolvedValue({
        id: 'sub-free',
      });

      const result = await subscriptionsService.initiateUpgrade(
        'org-free-123',
        'user-1',
        {
          planId: 'plan-free',
          billingInterval: 'MONTHLY',
          currency: 'INR',
        },
      );

      expect(result.amount).toBe(0);
      expect(prisma.organizationSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-free-123' },
          update: expect.objectContaining({
            planId: 'plan-free',
            status: 'ACTIVE',
          }),
        }),
      );
    });
  });

  describe('Adversarial Challenge 6: Quota Integration Hooks in Domain Services', () => {
    it('OrganizationsService.inviteMember delegates to assertCanInviteMember and aborts on quota breach', async () => {
      const mockNotificationsService = {
        queueEmail: jest.fn().mockResolvedValue(true),
      };

      const orgsService = new OrganizationsService(
        prisma,
        mockNotificationsService as any,
        enforcementService,
      );

      // Inviter is OWNER
      prisma.organizationMember.findUnique.mockResolvedValueOnce({
        organizationId: 'org-hook-1',
        userId: 'owner-1',
        role: OrganizationRole.OWNER,
        organization: { id: 'org-hook-1', name: 'Hook Org' },
      });

      // Subscription has maxMembers = 5, and org already has 5 members
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: 5 },
        customMaxMembers: null,
      });
      prisma.organizationMember.count.mockResolvedValue(5);
      prisma.organizationInvitation.count.mockResolvedValue(0);

      // Attempt invitation
      await expect(
        orgsService.inviteMember('org-hook-1', 'owner-1', {
          email: 'newuser@hook.org',
          role: OrganizationRole.MEMBER,
        }),
      ).rejects.toThrow(ForbiddenException);

      // Ensure no invitation record was created in database
      expect(prisma.organizationInvitation.create).not.toHaveBeenCalled();
    });

    it('ProjectsService.createProject delegates to assertCanCreateProject for customer users and blocks on quota breach', async () => {
      const mockProjectsRepo = {
        create: jest.fn(),
        getProjectStats: jest.fn(),
      };
      const mockGithubService = {} as any;
      const mockTasksService = {} as any;

      const projectsService = new ProjectsService(
        mockProjectsRepo as any,
        prisma,
        mockGithubService,
        mockTasksService,
        enforcementService,
      );

      // Customer user with activeOrganizationId
      const customerUser = {
        id: 'cust-1',
        userType: 'CUSTOMER',
        activeOrganizationId: 'org-proj-hook',
      };

      // Subscription limit is 10, current count is 10
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxProjects: 10 },
        customMaxProjects: null,
      });
      prisma.project.count.mockResolvedValue(10);

      await expect(
        projectsService.createProject(
          { name: 'Over Limit Project' } as any,
          customerUser,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Ensure repository create was NOT called
      expect(mockProjectsRepo.create).not.toHaveBeenCalled();
    });

    it('AssetsService.createAsset delegates to assertCanAttachServer and blocks VPS creation on quota breach', async () => {
      const mockAssetsRepo = {
        create: jest.fn(),
      };

      const assetsService = new AssetsService(
        mockAssetsRepo as any,
        prisma,
        enforcementService,
      );

      // Subscription limit is 1 server, current count is 1
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxServers: 1 },
        customMaxServers: null,
      });
      prisma.asset.count.mockResolvedValue(1);

      await expect(
        assetsService.createAsset({
          name: 'Extra Server',
          type: 'VPS',
          organizationId: 'org-asset-hook',
        } as any),
      ).rejects.toThrow(ForbiddenException);

      // Ensure asset create was NOT called
      expect(prisma.asset.create).not.toHaveBeenCalled();
    });

    it('GuardianController.generateInstallToken blocks token generation when asset org server quota is full', async () => {
      const mockGuardianService = {
        generateInstallToken: jest.fn(),
      };

      const guardianController = new GuardianController(
        mockGuardianService as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        prisma,
        enforcementService,
      );

      // Asset belongs to an organization
      prisma.asset.findUnique.mockResolvedValue({
        id: 'asset-123',
        organizationId: 'org-guardian-hook',
      });

      // Org is at server capacity
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxServers: 2 },
        customMaxServers: null,
      });
      prisma.asset.count.mockResolvedValue(2);

      const req = { user: { id: 'user-guardian' } };

      await expect(
        guardianController.generateInstallToken(req, 'client-1', 'asset-123'),
      ).rejects.toThrow(ForbiddenException);

      // Verify service token generator was NOT invoked
      expect(mockGuardianService.generateInstallToken).not.toHaveBeenCalled();
    });
  });
});
