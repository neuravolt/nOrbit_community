import { Test, TestingModule } from '@nestjs/testing';
import { PlansEnforcementService } from '../plans-enforcement.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

describe('PlansEnforcementService', () => {
  let service: PlansEnforcementService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      organizationSubscription: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      plan: {
        findFirst: jest.fn(),
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansEnforcementService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PlansEnforcementService>(PlansEnforcementService);
  });

  describe('Member Limits Enforcement (assertCanInviteMember)', () => {
    it('allows inviting member when current count is strictly below limit', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: 5 },
        customMaxMembers: null,
      });
      prisma.organizationMember.count.mockResolvedValue(2);
      prisma.organizationInvitation.count.mockResolvedValue(1);

      await expect(
        service.assertCanInviteMember('org-1'),
      ).resolves.not.toThrow();
    });

    it('blocks invitation when member count reaches limit with LIMIT_EXCEEDED code', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: 5 },
        customMaxMembers: null,
      });
      prisma.organizationMember.count.mockResolvedValue(3);
      prisma.organizationInvitation.count.mockResolvedValue(2); // total = 5

      await expect(service.assertCanInviteMember('org-1')).rejects.toThrow(
        ForbiddenException,
      );

      try {
        await service.assertCanInviteMember('org-1');
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: 'LIMIT_EXCEEDED',
          resource: 'members',
          limit: 5,
          current: 5,
        });
      }
    });

    it('respects customMaxMembers override above the plan limit', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: 5 },
        customMaxMembers: 10, // Admin override
      });
      prisma.organizationMember.count.mockResolvedValue(6);
      prisma.organizationInvitation.count.mockResolvedValue(0);

      // Should not throw because 6 < 10
      await expect(
        service.assertCanInviteMember('org-1'),
      ).resolves.not.toThrow();
    });

    it('allows unlimited members when limit is -1', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxMembers: -1 },
        customMaxMembers: null,
      });
      prisma.organizationMember.count.mockResolvedValue(100);
      prisma.organizationInvitation.count.mockResolvedValue(50);

      await expect(
        service.assertCanInviteMember('org-1'),
      ).resolves.not.toThrow();
    });
  });

  describe('Project Limits Enforcement (assertCanCreateProject)', () => {
    it('blocks project creation when count reaches maxProjects', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxProjects: 10 },
        customMaxProjects: null,
      });
      prisma.project.count.mockResolvedValue(10);

      await expect(service.assertCanCreateProject('org-1')).rejects.toThrow(
        ForbiddenException,
      );

      try {
        await service.assertCanCreateProject('org-1');
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: 'LIMIT_EXCEEDED',
          resource: 'projects',
          limit: 10,
          current: 10,
        });
      }
    });

    it('allows project creation when count is below maxProjects', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxProjects: 10 },
        customMaxProjects: null,
      });
      prisma.project.count.mockResolvedValue(9);

      await expect(
        service.assertCanCreateProject('org-1'),
      ).resolves.not.toThrow();
    });
  });

  describe('Server Limits Enforcement (assertCanAttachServer)', () => {
    it('blocks BYOVPS server attachment when count reaches maxServers', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxServers: 1 },
        customMaxServers: null,
      });
      prisma.asset.count.mockResolvedValue(1);

      await expect(service.assertCanAttachServer('org-1')).rejects.toThrow(
        ForbiddenException,
      );

      try {
        await service.assertCanAttachServer('org-1');
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: 'LIMIT_EXCEEDED',
          resource: 'servers',
          limit: 1,
          current: 1,
        });
      }
    });

    it('allows server attachment when below maxServers', async () => {
      prisma.organizationSubscription.findUnique.mockResolvedValue({
        plan: { maxServers: 5 },
        customMaxServers: null,
      });
      prisma.asset.count.mockResolvedValue(2);

      await expect(
        service.assertCanAttachServer('org-1'),
      ).resolves.not.toThrow();
    });
  });
});
