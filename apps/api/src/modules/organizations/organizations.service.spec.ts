import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationRole } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let mockPrisma: any;
  let mockNotificationsService: any;

  beforeEach(async () => {
    mockPrisma = {
      organization: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      organizationMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      organizationInvitation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockNotificationsService = {
      queueEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    jest.clearAllMocks();
  });

  describe('createOrganization', () => {
    it('creates organization, assigns creator as OWNER, and sets active org', async () => {
      mockPrisma.organization.create.mockResolvedValue({
        id: 'org-1',
        name: 'Acme Corp',
        domain: 'acme.com',
        members: [{ userId: 'user-1', role: OrganizationRole.OWNER }],
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        activeOrganizationId: 'org-1',
      });

      const result = await service.createOrganization('user-1', {
        name: 'Acme Corp',
        domain: 'acme.com',
      });

      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: 'Acme Corp',
          domain: 'acme.com',
          members: {
            create: {
              userId: 'user-1',
              role: OrganizationRole.OWNER,
            },
          },
        },
        include: { members: true },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { activeOrganizationId: 'org-1' },
      });
      expect(result.success).toBe(true);
      expect(result.organization.id).toBe('org-1');
      expect(result.organization.role).toBe(OrganizationRole.OWNER);
    });

    it('rejects blank organization name', async () => {
      await expect(
        service.createOrganization('user-1', { name: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyOrganizations', () => {
    it('returns memberships with active indicator and counts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        activeOrganizationId: 'org-1',
      });
      mockPrisma.organizationMember.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          role: OrganizationRole.OWNER,
          joinedAt: new Date('2026-01-01'),
          organization: {
            id: 'org-1',
            name: 'Acme Corp',
            domain: 'acme.com',
            createdAt: new Date('2026-01-01'),
            _count: { members: 5, projects: 3, clients: 2 },
          },
        },
      ]);

      const result = await service.getMyOrganizations('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('org-1');
      expect(result[0].isCurrent).toBe(true);
      expect(result[0].memberCount).toBe(5);
    });
  });

  describe('getOrganizationDetails', () => {
    it('returns details if user is a member', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'user-1',
        role: OrganizationRole.MEMBER,
        joinedAt: new Date(),
        organization: {
          id: 'org-1',
          name: 'Acme Corp',
          domain: 'acme.com',
          _count: {
            members: 3,
            projects: 2,
            tasks: 10,
            clients: 1,
            invoices: 4,
          },
        },
      });

      const details = await service.getOrganizationDetails('org-1', 'user-1');
      expect(details.id).toBe('org-1');
      expect(details.role).toBe(OrganizationRole.MEMBER);
      expect(details.stats.members).toBe(3);
    });

    it('throws ForbiddenException if user is not a member', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrganizationDetails('org-1', 'user-stranger'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('inviteMember', () => {
    it('dispatches invitation when requester is OWNER', async () => {
      mockPrisma.organizationMember.findUnique
        .mockResolvedValueOnce({
          organizationId: 'org-1',
          userId: 'owner-1',
          role: OrganizationRole.OWNER,
          organization: { id: 'org-1', name: 'Acme Corp' },
        })
        .mockResolvedValueOnce(null); // not already member

      mockPrisma.user.findUnique.mockResolvedValue(null); // not registered yet
      mockPrisma.organizationInvitation.updateMany.mockResolvedValue({
        count: 0,
      });
      mockPrisma.organizationInvitation.create.mockResolvedValue({
        id: 'inv-1',
        email: 'colleague@example.com',
      });

      const res = await service.inviteMember('org-1', 'owner-1', {
        email: 'colleague@example.com',
        role: OrganizationRole.MEMBER,
      });

      expect(res.success).toBe(true);
      expect(mockNotificationsService.queueEmail).toHaveBeenCalled();
    });

    it('blocks invitation when requester is only a MEMBER', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'mem-1',
        role: OrganizationRole.MEMBER,
        organization: { id: 'org-1', name: 'Acme Corp' },
      });

      await expect(
        service.inviteMember('org-1', 'mem-1', {
          email: 'colleague@example.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks invitation if user is already a member', async () => {
      mockPrisma.organizationMember.findUnique
        .mockResolvedValueOnce({
          organizationId: 'org-1',
          userId: 'owner-1',
          role: OrganizationRole.OWNER,
          organization: { id: 'org-1', name: 'Acme Corp' },
        })
        .mockResolvedValueOnce({
          organizationId: 'org-1',
          userId: 'existing-user-id',
        });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user-id',
        email: 'existing@example.com',
      });

      await expect(
        service.inviteMember('org-1', 'owner-1', {
          email: 'existing@example.com',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getInvitationByToken', () => {
    it('returns invitation details if valid', async () => {
      const rawToken = 'sampletoken1234567890abcdef12345678';
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        tokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
        email: 'newuser@example.com',
        role: OrganizationRole.MEMBER,
        organization: { id: 'org-1', name: 'Acme Corp' },
        invitedBy: {
          firstName: 'Alice',
          lastName: 'Owner',
          email: 'alice@acme.com',
        },
      });

      const result = await service.getInvitationByToken(rawToken);
      expect(result.valid).toBe(true);
      expect(result.organizationName).toBe('Acme Corp');
    });

    it('throws NotFoundException if expired or not found', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(null);

      await expect(
        service.getInvitationByToken('invalid-or-expired-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptInvitation', () => {
    it('adds member, marks accepted, and activates organization', async () => {
      const rawToken = 'validtoken123';
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        tokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
        email: 'user@example.com',
        role: OrganizationRole.MEMBER,
        organization: { id: 'org-1', name: 'Acme Corp' },
        invitedBy: {
          firstName: 'Alice',
          lastName: 'Owner',
          email: 'alice@acme.com',
        },
      });

      mockPrisma.organizationMember.upsert.mockResolvedValue({
        id: 'mem-new',
        organizationId: 'org-1',
        userId: 'user-2',
        role: OrganizationRole.MEMBER,
      });
      mockPrisma.organizationInvitation.update.mockResolvedValue({
        id: 'inv-1',
        status: 'ACCEPTED',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-2',
        activeOrganizationId: 'org-1',
      });

      const res = await service.acceptInvitation('user-2', rawToken);
      expect(res.success).toBe(true);
      expect(res.organizationId).toBe('org-1');
      expect(mockPrisma.organizationMember.upsert).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { activeOrganizationId: 'org-1' },
      });
    });
  });

  describe('updateMemberRole', () => {
    it('allows OWNER to change member role', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'owner-1',
        role: OrganizationRole.OWNER,
      });
      mockPrisma.organizationMember.update.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'target-1',
        role: OrganizationRole.ADMIN,
      });

      const res = await service.updateMemberRole(
        'org-1',
        'target-1',
        OrganizationRole.ADMIN,
        'owner-1',
      );
      expect(res.success).toBe(true);
      expect(res.member.role).toBe(OrganizationRole.ADMIN);
    });

    it('prevents OWNER from demoting themselves', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'owner-1',
        role: OrganizationRole.OWNER,
      });

      await expect(
        service.updateMemberRole(
          'org-1',
          'owner-1',
          OrganizationRole.MEMBER,
          'owner-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMember', () => {
    it('allows OWNER to remove a member and cleans up activeOrganizationId', async () => {
      mockPrisma.organizationMember.findUnique
        .mockResolvedValueOnce({
          organizationId: 'org-1',
          userId: 'owner-1',
          role: OrganizationRole.OWNER,
        })
        .mockResolvedValueOnce({
          organizationId: 'org-1',
          userId: 'target-1',
          role: OrganizationRole.MEMBER,
        });

      mockPrisma.organizationMember.delete.mockResolvedValue({ id: 'mem-del' });
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.removeMember('org-1', 'target-1', 'owner-1');
      expect(res.success).toBe(true);
      expect(mockPrisma.organizationMember.delete).toHaveBeenCalled();
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'target-1', activeOrganizationId: 'org-1' },
        data: { activeOrganizationId: null },
      });
    });

    it('prevents removing the organization OWNER', async () => {
      mockPrisma.organizationMember.findUnique
        .mockResolvedValueOnce({
          organizationId: 'org-1',
          userId: 'owner-1',
          role: OrganizationRole.OWNER,
        })
        .mockResolvedValueOnce({
          organizationId: 'org-1',
          userId: 'owner-1',
          role: OrganizationRole.OWNER,
        });

      await expect(
        service.removeMember('org-1', 'owner-1', 'owner-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
