import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('UnifiedRolesGuard (Dual-Plane Authorization)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let mockPrisma: any;

  beforeEach(() => {
    reflector = new Reflector();
    mockPrisma = {
      userRole: {
        findMany: jest.fn(),
      },
      organizationMember: {
        findUnique: jest.fn(),
      },
    };
    guard = new RolesGuard(reflector, mockPrisma);
  });

  const createMockContext = (
    user: any,
    headers: Record<string, string> = {},
    controllerName = 'ProjectsController',
    handlerName = 'getProjectById',
    method = 'GET',
  ): ExecutionContext => {
    return {
      getHandler: () => ({ name: handlerName }),
      getClass: () => ({ name: controllerName }),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers,
          method,
        }),
      }),
    } as any;
  };

  it('allows access if no roles are required', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    const context = createMockContext({ id: 'user-1' });
    expect(await guard.canActivate(context)).toBe(true);
  });

  describe('Staff Plane (Legacy RBAC)', () => {
    it('grants universal access to staff SUPER_ADMIN', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['ADMIN', 'HR_MANAGER']);
      const context = createMockContext({
        id: 'staff-1',
        role: 'SUPER_ADMIN',
        userType: 'STAFF',
      });
      expect(await guard.canActivate(context)).toBe(true);
    });

    it('grants access when staff user has matching custom role', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['PROJECT_MANAGER']);
      mockPrisma.userRole.findMany.mockResolvedValue([
        { role: { name: 'PROJECT_MANAGER' } },
      ]);
      const context = createMockContext({
        id: 'staff-2',
        role: 'EMPLOYEE',
        userType: 'STAFF',
      });
      expect(await guard.canActivate(context)).toBe(true);
    });

    it('rejects staff user without matching role', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['FINANCE']);
      mockPrisma.userRole.findMany.mockResolvedValue([
        { role: { name: 'DEVELOPER' } },
      ]);
      const context = createMockContext({
        id: 'staff-3',
        role: 'EMPLOYEE',
        userType: 'STAFF',
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Customer Plane (Multi-Tenant Org RBAC)', () => {
    it('rejects customer accessing internal-only controllers like AccountingController', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['SUPER_ADMIN']);
      const context = createMockContext(
        { id: 'cust-1', userType: 'CUSTOMER', activeOrganizationId: 'org-1' },
        {},
        'AccountingController',
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Access denied: customers cannot access internal staff resources',
      );
    });

    it('rejects customer accessing internal GitHub integration handlers in ProjectsController', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['SUPER_ADMIN']);
      const context = createMockContext(
        { id: 'cust-1', userType: 'CUSTOMER', activeOrganizationId: 'org-1' },
        {},
        'ProjectsController',
        'listAvailableGithubRepositories',
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Access denied: GitHub integration is restricted to internal team projects',
      );
    });

    it('rejects customer without active organization context', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['MEMBER']);
      const context = createMockContext({
        id: 'cust-1',
        userType: 'CUSTOMER',
        activeOrganizationId: null,
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Active organization context required',
      );
    });

    it('rejects customer when not a member of the organization', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['MEMBER']);
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);
      const context = createMockContext(
        {
          id: 'cust-1',
          userType: 'CUSTOMER',
          activeOrganizationId: 'org-target',
        },
        { 'x-organization-id': 'org-target' },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'You are not a member of this organization',
      );
    });

    it('allows customer OWNER when ADMIN or MEMBER is required', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['ADMIN']);
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'cust-1',
        role: 'OWNER',
      });
      const context = createMockContext({
        id: 'cust-1',
        userType: 'CUSTOMER',
        activeOrganizationId: 'org-1',
      });
      expect(await guard.canActivate(context)).toBe(true);
    });

    it('rejects customer VIEWER when attempting a POST (write)', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['MEMBER']);
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'cust-viewer',
        role: 'VIEWER',
      });
      const context = createMockContext(
        {
          id: 'cust-viewer',
          userType: 'CUSTOMER',
          activeOrganizationId: 'org-1',
        },
        {},
        'ProjectsController',
        'createProject',
        'POST',
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Viewers only have read permissions in customer workspace',
      );
    });

    it('allows customer VIEWER when performing a GET (read)', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['VIEWER']);
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'cust-viewer',
        role: 'VIEWER',
      });
      const context = createMockContext(
        {
          id: 'cust-viewer',
          userType: 'CUSTOMER',
          activeOrganizationId: 'org-1',
        },
        {},
        'ProjectsController',
        'getProjectById',
        'GET',
      );
      expect(await guard.canActivate(context)).toBe(true);
    });

    it('rejects customer MEMBER when attempting a DELETE operation', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['MEMBER']);
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'cust-member',
        role: 'MEMBER',
      });
      const context = createMockContext(
        {
          id: 'cust-member',
          userType: 'CUSTOMER',
          activeOrganizationId: 'org-1',
        },
        {},
        'ProjectsController',
        'deleteProject',
        'DELETE',
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Forbidden: requires organization ADMIN or OWNER role',
      );
    });

    it('allows customer OWNER when attempting a DELETE operation', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['MEMBER']);
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'cust-owner',
        role: 'OWNER',
      });
      const context = createMockContext(
        {
          id: 'cust-owner',
          userType: 'CUSTOMER',
          activeOrganizationId: 'org-1',
        },
        {},
        'ProjectsController',
        'deleteProject',
        'DELETE',
      );
      expect(await guard.canActivate(context)).toBe(true);
    });
  });
});
