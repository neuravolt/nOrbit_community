import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../common';

export const Permissions = Reflector.createDecorator<string[]>();

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
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get(
      Permissions,
      context.getHandler(),
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not found');
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

      const role = membership.role;
      // VIEWER only has read access
      if (role === 'VIEWER') {
        const isRead = requiredPermissions.every(
          (p) =>
            p.includes(':read') ||
            p.includes(':view') ||
            p.includes(':list') ||
            p.includes(':get'),
        );
        if (!isRead) {
          throw new ForbiddenException('Viewers only have read permissions');
        }
      }

      // MEMBER cannot perform delete operations
      if (role === 'MEMBER') {
        const hasDelete = requiredPermissions.some((p) =>
          p.includes(':delete'),
        );
        if (hasDelete) {
          throw new ForbiddenException(
            'Forbidden: requires organization ADMIN or OWNER role',
          );
        }
      }

      return true;
    }

    // SUPER_ADMIN has unrestricted access to all resources
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Get user's roles and their permissions
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Collect all user permissions as strings in both full and base formats
    const userPermissions = new Set<string>();
    userRoles.forEach((userRole) => {
      userRole.role.permissions.forEach((rolePermission) => {
        const basePermission = `${rolePermission.permission.resource}:${rolePermission.permission.action}`;
        userPermissions.add(basePermission);

        const fullPermission = `${rolePermission.permission.resource}:${rolePermission.permission.action}:${rolePermission.permission.scope}`;
        userPermissions.add(fullPermission);
      });
    });

    // Check if user has any of the required permissions.
    // Normalize plural resource names (e.g. "clients:create" → "client:create")
    // to match the singular form stored in the permission matrix.
    const hasPermission = requiredPermissions.some((requiredPerm) => {
      if (userPermissions.has(requiredPerm)) return true;
      // Try singular form: strip trailing 's' from the resource part
      const normalized = normalizePermission(requiredPerm);
      return userPermissions.has(normalized);
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions. Required one of: [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}

/**
 * Normalizes a permission string from plural resource form to singular form.
 * Example: "clients:create" → "client:create"
 *          "projects:read:organization" → "project:read:organization"
 * This bridges the gap between controller decorators (plural) and DB-stored
 * permission names (singular).
 */
function normalizePermission(permission: string): string {
  const parts = permission.split(':');
  if (parts.length < 2) return permission;

  const resource = parts[0];
  const rest = parts.slice(1).join(':');

  // Map of known plural → singular overrides
  const pluralToSingular: Record<string, string> = {
    clients: 'client',
    projects: 'project',
    tasks: 'task',
    tickets: 'ticket',
    assets: 'asset',
    leads: 'lead',
    users: 'user',
    roles: 'role',
    permissions: 'permission',
    invoices: 'invoice',
    quotes: 'quote',
    reports: 'report',
    notifications: 'notification',
    meetings: 'meeting',
  };

  const singular = pluralToSingular[resource] ?? resource;
  return `${singular}:${rest}`;
}
