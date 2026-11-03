import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrganizationDto, InviteMemberDto } from './dto/organization.dto';
import { OrganizationRole } from '@prisma/client';
import { PlansEnforcementService } from '../plans/plans-enforcement.service';
import * as crypto from 'crypto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Optional()
    private readonly plansEnforcementService?: PlansEnforcementService,
  ) {}

  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    const trimmedName = dto.name.trim();
    if (!trimmedName) {
      throw new BadRequestException('Organization name is required');
    }

    const org = await this.prisma.organization.create({
      data: {
        name: trimmedName,
        domain: dto.domain?.trim().toLowerCase() || null,
        members: {
          create: {
            userId,
            role: OrganizationRole.OWNER,
          },
        },
      },
      include: {
        members: true,
      },
    });

    // Set as active organization for the creator
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeOrganizationId: org.id },
    });

    // Ensure default Starter plan subscription is attached
    try {
      const starterPlan = await this.prisma.plan.findFirst({
        where: { slug: 'starter', deletedAt: null },
      });
      if (starterPlan) {
        await this.prisma.organizationSubscription.create({
          data: {
            organizationId: org.id,
            planId: starterPlan.id,
            status: 'ACTIVE',
            billingInterval: 'MONTHLY',
            currency: 'INR',
          },
        });
      }
    } catch (subErr) {
      this.logger.warn(
        `Failed to attach default subscription for org ${org.id}: ${subErr.message}`,
      );
    }

    return {
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        domain: org.domain,
        role: OrganizationRole.OWNER,
      },
    };
  }

  async getMyOrganizations(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeOrganizationId: true },
    });

    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            domain: true,
            createdAt: true,
            _count: {
              select: {
                members: true,
                projects: true,
                clients: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      domain: m.organization.domain,
      role: m.role,
      joinedAt: m.joinedAt,
      isCurrent: m.organization.id === user?.activeOrganizationId,
      memberCount: m.organization._count.members,
      projectCount: m.organization._count.projects,
      clientCount: m.organization._count.clients,
    }));
  }

  async getOrganizationDetails(orgId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: true,
                projects: true,
                tasks: true,
                clients: true,
                invoices: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    return {
      id: membership.organization.id,
      name: membership.organization.name,
      domain: membership.organization.domain,
      role: membership.role,
      joinedAt: membership.joinedAt,
      stats: membership.organization._count,
    };
  }

  async listMembers(orgId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    const invitations = await this.prisma.organizationInvitation.findMany({
      where: {
        organizationId: orgId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      pendingInvitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        invitedBy: inv.invitedBy,
      })),
    };
  }

  async inviteMember(
    orgId: string,
    inviterUserId: string,
    dto: InviteMemberDto,
  ) {
    const inviterMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: inviterUserId,
        },
      },
      include: { organization: true },
    });

    if (
      !inviterMembership ||
      (inviterMembership.role !== OrganizationRole.OWNER &&
        inviterMembership.role !== OrganizationRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Only organization Owners or Admins can send invitations.',
      );
    }

    // Quota Enforcement: Check if organization has reached maxMembers limit
    if (this.plansEnforcementService) {
      await this.plansEnforcementService.assertCanInviteMember(orgId);
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const assignedRole = dto.role || OrganizationRole.MEMBER;

    // Check if user is already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      const existingMember = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: existingUser.id,
          },
        },
      });
      if (existingMember) {
        throw new ConflictException(
          'This user is already a member of this organization.',
        );
      }
    }

    // Generate cryptographic token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Revoke any existing pending invitations for this email in this org
    await this.prisma.organizationInvitation.updateMany({
      where: {
        organizationId: orgId,
        email: normalizedEmail,
        status: 'PENDING',
      },
      data: { status: 'REVOKED' },
    });

    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        organizationId: orgId,
        email: normalizedEmail,
        role: assignedRole,
        tokenHash,
        invitedById: inviterUserId,
        expiresAt,
        status: 'PENDING',
      },
    });

    // Dispatch invitation email
    const inviteUrl = `https://norbit.neuravolt.in/onboarding/join?token=${rawToken}`;
    try {
      await this.notificationsService.queueEmail(
        normalizedEmail,
        'organization_invitation',
        {
          organizationName: inviterMembership.organization.name,
          inviteUrl,
          rawToken,
          role: assignedRole,
        },
        `Invitation to join ${inviterMembership.organization.name} on NORBIT`,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch invitation email: ${err.message}`);
    }

    return {
      success: true,
      message: `Invitation dispatched to ${normalizedEmail}`,
      invitationId: invitation.id,
      token: process.env.NODE_ENV !== 'production' ? rawToken : undefined,
    };
  }

  async getInvitationByToken(rawToken: string) {
    if (!rawToken || !rawToken.trim()) {
      throw new BadRequestException('Invitation token is required');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken.trim())
      .digest('hex');

    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { tokenHash },
      include: {
        organization: { select: { id: true, name: true } },
        invitedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (
      !invitation ||
      invitation.status !== 'PENDING' ||
      invitation.expiresAt < new Date()
    ) {
      throw new NotFoundException('Invitation not found or has expired');
    }

    return {
      valid: true,
      organizationId: invitation.organization.id,
      organizationName: invitation.organization.name,
      email: invitation.email,
      role: invitation.role,
      invitedBy:
        `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`.trim(),
    };
  }

  async acceptInvitation(userId: string, rawToken: string) {
    const invitationDetails = await this.getInvitationByToken(rawToken);

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken.trim())
      .digest('hex');

    // Add or update membership
    await this.prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitationDetails.organizationId,
          userId,
        },
      },
      create: {
        organizationId: invitationDetails.organizationId,
        userId,
        role: invitationDetails.role,
      },
      update: {
        role: invitationDetails.role,
      },
    });

    // Mark invitation accepted
    await this.prisma.organizationInvitation.update({
      where: { tokenHash },
      data: { status: 'ACCEPTED' },
    });

    // Set as active organization
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeOrganizationId: invitationDetails.organizationId },
    });

    return {
      success: true,
      message: `You have successfully joined ${invitationDetails.organizationName}`,
      organizationId: invitationDetails.organizationId,
      organizationName: invitationDetails.organizationName,
      role: invitationDetails.role,
    };
  }

  async updateMemberRole(
    orgId: string,
    targetUserId: string,
    newRole: OrganizationRole,
    requesterUserId: string,
  ) {
    const requester = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: requesterUserId,
        },
      },
    });

    if (!requester || requester.role !== OrganizationRole.OWNER) {
      throw new ForbiddenException(
        'Only the organization Owner can change member roles.',
      );
    }

    if (
      targetUserId === requesterUserId &&
      newRole !== OrganizationRole.OWNER
    ) {
      throw new BadRequestException(
        'Organization Owner cannot demote themselves.',
      );
    }

    const updated = await this.prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: targetUserId,
        },
      },
      data: { role: newRole },
    });

    return {
      success: true,
      member: updated,
    };
  }

  async removeMember(
    orgId: string,
    targetUserId: string,
    requesterUserId: string,
  ) {
    const requester = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: requesterUserId,
        },
      },
    });

    if (
      !requester ||
      (requester.role !== OrganizationRole.OWNER &&
        requester.role !== OrganizationRole.ADMIN &&
        targetUserId !== requesterUserId)
    ) {
      throw new ForbiddenException(
        'You do not have permission to remove this member.',
      );
    }

    const target = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: targetUserId,
        },
      },
    });

    if (target?.role === OrganizationRole.OWNER) {
      throw new BadRequestException('Organization Owner cannot be removed.');
    }

    await this.prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: targetUserId,
        },
      },
    });

    // If active org was removed, reset user activeOrganizationId
    await this.prisma.user.updateMany({
      where: { id: targetUserId, activeOrganizationId: orgId },
      data: { activeOrganizationId: null },
    });

    return {
      success: true,
      message: 'Member removed successfully.',
    };
  }
}
