import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../common/prisma/prisma.service';

export const Roles = Reflector.createDecorator<string[]>();

const CUSTOMER_ALLOWED_CONTROLLERS = new Set([
  'ProjectsController',
  'TasksController',
  'ClientsController',
  'BillingController',
  'TicketsController',
  'OrganizationsController',
  'UploadsController',
  'AuthController',
  'CustomerPlansController',
  'SalesController',
  'LeadsController',
  'AmcController',
  'CompanyProfileController',
  'ChatController',
  'MeetingsController',
  'MailboxController',
  'ManualPaymentsController',
  'PaymentsController',
  'ReportsController',
  'HrController',
  'HrmsController',
]);

const INTERNAL_ONLY_HANDLERS = new Set([
  'listAvailableGithubRepositories',
  'bindGithubRepository',
  'unbindGithubRepository',
  'checkPullRequestMergeability',
  'mergeProjectPullRequest',
  'listProjectCollaborators',
  'searchProjectCollaborators',
  'inviteProjectCollaborator',
  'cancelProjectInvitation',
  'removeProjectCollaborator',
]);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Forbidden: requires authentication');
    }

    // Dual-Plane Authorization: Customer Workspace Plane
    if (user.userType === 'CUSTOMER') {
      const controllerName = context.getClass()?.name || '';
      if (controllerName && !CUSTOMER_ALLOWED_CONTROLLERS.has(controllerName)) {
        throw new ForbiddenException(
          'Access denied: customers cannot access internal staff resources',
        );
      }

      const handlerName = context.getHandler()?.name || '';
      if (handlerName && INTERNAL_ONLY_HANDLERS.has(handlerName)) {
        throw new ForbiddenException(
          'Access denied: GitHub integration is restricted to internal team projects',
        );
      }

      const activeOrgId =
        request.headers['x-organization-id'] || user.activeOrganizationId;
      if (!activeOrgId) {
        throw new ForbiddenException('Active organization context required');
      }

      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: activeOrgId,
            userId: user.id,
          },
        },
      });

      if (!membership) {
        throw new ForbiddenException(
          'You are not a member of this organization',
        );
      }

      user.activeOrganizationId = activeOrgId;
      request.organizationMember = membership;
      request.tenantId = activeOrgId;

      const orgRole = (membership.role || '').toUpperCase();
      const customerRoleHierarchy: Record<string, string[]> = {
        OWNER: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
        ADMIN: ['ADMIN', 'MEMBER', 'VIEWER'],
        MEMBER: ['MEMBER', 'VIEWER'],
        VIEWER: ['VIEWER'],
      };
      const grantedRoles = customerRoleHierarchy[orgRole] || [orgRole];

      // In customer-allowed workspace controllers, tenant OWNER, ADMIN or user with MANAGER role
      // has workspace management authority for their organization.
      const isWorkspaceAdmin =
        orgRole === 'OWNER' || orgRole === 'ADMIN' || user.role === 'MANAGER';
      if (isWorkspaceAdmin) {
        return true;
      }

      // VIEWER is strictly read-only
      if (orgRole === 'VIEWER') {
        const isRead = request.method === 'GET' || request.method === 'HEAD';
        const isExplicitViewerAllowed = requiredRoles.some(
          (r) => r.toUpperCase() === 'VIEWER',
        );
        if (!isRead && !isExplicitViewerAllowed) {
          throw new ForbiddenException(
            'Viewers only have read permissions in customer workspace',
          );
        }
      }

      // MEMBER cannot perform deletions or admin-restricted operations
      if (orgRole === 'MEMBER') {
        const isDelete = request.method === 'DELETE';
        const isAdminOnly = requiredRoles.every((r) =>
          ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'CO_FOUNDER'].includes(
            r.toUpperCase(),
          ),
        );
        if (isDelete || isAdminOnly) {
          throw new ForbiddenException(
            'Forbidden: requires organization ADMIN or OWNER role',
          );
        }
      }

      // If required roles explicitly list customer organization roles, verify hierarchy
      const hasCustomerRoleCheck = requiredRoles.some((r) =>
        ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(r.toUpperCase()),
      );

      // Defense-in-depth: If endpoint requires staff-only roles without customer roles, block customer immediately
      const hasStaffOnlyRequirement = requiredRoles.some((r) =>
        [
          'SUPER_ADMIN',
          'ADMIN',
          'MANAGER',
          'DEVELOPER',
          'QA',
          'SALES',
          'SUPPORT',
          'ACCOUNTANT',
          'EMPLOYEE',
        ].includes(r.toUpperCase()),
      );
      if (hasStaffOnlyRequirement && !hasCustomerRoleCheck) {
        throw new ForbiddenException(
          'Forbidden: customer roles cannot access staff administrative resources',
        );
      }

      if (hasCustomerRoleCheck) {
        const hasRole = requiredRoles.some((r) =>
          grantedRoles.includes(r.toUpperCase()),
        );
        if (!hasRole) {
          throw new ForbiddenException(
            `Forbidden: requires one of [${requiredRoles.join(', ')}]`,
          );
        }
      }

      return true;
    }

    // Legacy Staff Plane: SUPER_ADMIN always has universal access
    const sysRole = (user.role || '').toUpperCase();
    if (sysRole === 'SUPER_ADMIN') {
      return true;
    }

    // If requiredRoles requires SUPER_ADMIN and does not include ADMIN, do NOT allow ADMIN or CO_FOUNDER to bypass
    const upperRequiredRoles = requiredRoles.map((r) => r.toUpperCase());
    const requiresSuperAdminOnly =
      upperRequiredRoles.includes('SUPER_ADMIN') &&
      !upperRequiredRoles.includes('ADMIN');

    if (!requiresSuperAdminOnly) {
      if (sysRole === 'ADMIN' || sysRole === 'CO_FOUNDER') {
        return true;
      }
    }

    // Fetch user's custom roles from database
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });

    const roleNames = userRoles.map((ur) =>
      (ur.role?.name || '').toUpperCase(),
    );
    if (sysRole) {
      roleNames.push(sysRole);
    }

    const hasRole = requiredRoles.some((role) =>
      roleNames.includes(role.toUpperCase()),
    );
    if (!hasRole) {
      throw new ForbiddenException(
        `Forbidden: requires one of [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}

export const UnifiedRolesGuard = RolesGuard;
