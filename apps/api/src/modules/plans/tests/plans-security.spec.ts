import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/guards/roles.guard';
import { AdminPlansController } from '../admin-plans.controller';
import { AdminOrganizationsController } from '../admin-organizations.controller';
import { CustomerPlansController } from '../customer-plans.controller';

describe('Dynamic Plans & Subscriptions Security Boundaries', () => {
  let jwtGuard: JwtAuthGuard;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;
  let mockPrisma: any;

  beforeEach(() => {
    jwtGuard = new JwtAuthGuard();
    reflector = new Reflector();
    mockPrisma = {
      organizationMember: {
        findUnique: jest.fn(),
      },
      userRole: {
        findMany: jest.fn(),
      },
    };
    rolesGuard = new RolesGuard(reflector, mockPrisma);
  });

  const createMockContext = (
    controllerClass: any,
    handler: any,
    user: any,
    method = 'GET',
    headers: any = {},
  ): ExecutionContext => {
    const req = {
      user,
      method,
      headers: { ...headers },
    };
    return {
      getClass: () => controllerClass,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  describe('Super Admin Controller Gate Isolation (AdminPlansController)', () => {
    it.each(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])(
      'blocks customer role %s with 403 Forbidden via JwtAuthGuard controller gate',
      (customerRole) => {
        const customerUser = {
          id: 'cust-1',
          userType: 'CUSTOMER',
          activeOrganizationId: 'org-1',
          role: customerRole,
        };

        const ctx = createMockContext(
          AdminPlansController,
          AdminPlansController.prototype.createPlan,
          customerUser,
          'POST',
        );

        expect(() => {
          jwtGuard.handleRequest(null, customerUser, null, ctx);
        }).toThrow(ForbiddenException);
      },
    );

    it.each([
      'MANAGER',
      'DEVELOPER',
      'QA',
      'SALES',
      'ACCOUNTANT',
      'ADMIN',
      'CO_FOUNDER',
      'EMPLOYEE',
    ])(
      'blocks staff role %s without SUPER_ADMIN from AdminPlansController via RolesGuard with genuine metadata',
      async (staffRole) => {
        const staffUser = {
          id: 'staff-1',
          userType: 'STAFF',
          role: staffRole,
        };

        mockPrisma.userRole.findMany.mockResolvedValue([]);

        const ctx = createMockContext(
          AdminPlansController,
          AdminPlansController.prototype.createPlan,
          staffUser,
          'POST',
        );

        // Genuine Reflector reads metadata from controller class and handler without mocks
        await expect(rolesGuard.canActivate(ctx)).rejects.toThrow(
          ForbiddenException,
        );
      },
    );

    it('allows staff SUPER_ADMIN to access AdminPlansController with genuine metadata', async () => {
      const superAdminUser = {
        id: 'super-1',
        userType: 'STAFF',
        role: 'SUPER_ADMIN',
      };

      const ctx = createMockContext(
        AdminPlansController,
        AdminPlansController.prototype.createPlan,
        superAdminUser,
        'POST',
      );

      // Passes JwtAuthGuard
      const verifiedUser = jwtGuard.handleRequest(
        null,
        superAdminUser,
        null,
        ctx,
      );
      expect(verifiedUser).toBe(superAdminUser);

      // Passes RolesGuard with genuine metadata
      const canActivate = await rolesGuard.canActivate(ctx);
      expect(canActivate).toBe(true);
    });
  });

  describe('Organization Overrides Boundary (AdminOrganizationsController)', () => {
    it.each(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])(
      'blocks customer role %s with 403 Forbidden from AdminOrganizationsController',
      (customerRole) => {
        const customerUser = {
          id: 'cust-1',
          userType: 'CUSTOMER',
          activeOrganizationId: 'org-1',
          role: customerRole,
        };

        const ctx = createMockContext(
          AdminOrganizationsController,
          AdminOrganizationsController.prototype.updateSubscription,
          customerUser,
          'PATCH',
        );

        expect(() => {
          jwtGuard.handleRequest(null, customerUser, null, ctx);
        }).toThrow(ForbiddenException);
      },
    );

    it.each(['DEVELOPER', 'ADMIN', 'CO_FOUNDER'])(
      'blocks non-super-admin staff role %s from AdminOrganizationsController via genuine metadata',
      async (staffRole) => {
        const staffUser = {
          id: 'staff-1',
          userType: 'STAFF',
          role: staffRole,
        };
        mockPrisma.userRole.findMany.mockResolvedValue([]);

        const ctx = createMockContext(
          AdminOrganizationsController,
          AdminOrganizationsController.prototype.updateSubscription,
          staffUser,
          'PATCH',
        );

        await expect(rolesGuard.canActivate(ctx)).rejects.toThrow(
          ForbiddenException,
        );
      },
    );

    it('allows staff SUPER_ADMIN to access AdminOrganizationsController via genuine metadata', async () => {
      const superAdminUser = {
        id: 'super-admin',
        userType: 'STAFF',
        role: 'SUPER_ADMIN',
      };

      const ctx = createMockContext(
        AdminOrganizationsController,
        AdminOrganizationsController.prototype.updateSubscription,
        superAdminUser,
        'PATCH',
      );

      const canActivate = await rolesGuard.canActivate(ctx);
      expect(canActivate).toBe(true);
    });
  });

  describe('Customer Plans Controller Access (CustomerPlansController)', () => {
    it('allows customer user through JwtAuthGuard for CustomerPlansController', () => {
      const customerUser = {
        id: 'cust-1',
        userType: 'CUSTOMER',
        activeOrganizationId: 'org-1',
      };

      const ctx = createMockContext(
        CustomerPlansController,
        CustomerPlansController.prototype.getPublicPlans,
        customerUser,
        'GET',
      );

      const result = jwtGuard.handleRequest(null, customerUser, null, ctx);
      expect(result).toBe(customerUser);
    });

    describe('GET /plans/current Tenant Isolation', () => {
      it('blocks customer user when activeOrganizationId is missing', async () => {
        const customerUser = {
          id: 'cust-1',
          userType: 'CUSTOMER',
          activeOrganizationId: null,
        };

        const ctx = createMockContext(
          CustomerPlansController,
          CustomerPlansController.prototype.getCurrentSubscription,
          customerUser,
          'GET',
        );

        await expect(rolesGuard.canActivate(ctx)).rejects.toThrow(
          'Active organization context required',
        );
      });

      it('blocks customer user attempting cross-tenant inspection via spoofed x-organization-id header', async () => {
        const customerUser = {
          id: 'attacker-1',
          userType: 'CUSTOMER',
          activeOrganizationId: 'attacker-org',
        };

        // Prisma membership check returns null for victim organization
        mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

        const ctx = createMockContext(
          CustomerPlansController,
          CustomerPlansController.prototype.getCurrentSubscription,
          customerUser,
          'GET',
          { 'x-organization-id': 'victim-org-secret' },
        );

        await expect(rolesGuard.canActivate(ctx)).rejects.toThrow(
          'You are not a member of this organization',
        );
        expect(mockPrisma.organizationMember.findUnique).toHaveBeenCalledWith({
          where: {
            organizationId_userId: {
              organizationId: 'victim-org-secret',
              userId: 'attacker-1',
            },
          },
        });
      });

      it.each(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])(
        'allows legitimate customer member with role %s on GET /plans/current via genuine metadata',
        async (role) => {
          const customerUser = {
            id: 'cust-member-1',
            userType: 'CUSTOMER',
            activeOrganizationId: 'my-org',
          };

          mockPrisma.organizationMember.findUnique.mockResolvedValue({
            organizationId: 'my-org',
            userId: 'cust-member-1',
            role,
          });

          const ctx = createMockContext(
            CustomerPlansController,
            CustomerPlansController.prototype.getCurrentSubscription,
            customerUser,
            'GET',
          );

          const canActivate = await rolesGuard.canActivate(ctx);
          expect(canActivate).toBe(true);
        },
      );
    });

    describe('POST /plans/upgrade Role Hierarchy', () => {
      it.each(['OWNER', 'ADMIN'])(
        'allows customer role %s to access POST /plans/upgrade via genuine metadata',
        async (role) => {
          const customerUser = {
            id: 'cust-lead',
            userType: 'CUSTOMER',
            activeOrganizationId: 'org-1',
          };

          mockPrisma.organizationMember.findUnique.mockResolvedValue({
            organizationId: 'org-1',
            userId: 'cust-lead',
            role,
          });

          const ctx = createMockContext(
            CustomerPlansController,
            CustomerPlansController.prototype.upgradePlan,
            customerUser,
            'POST',
          );

          const canActivate = await rolesGuard.canActivate(ctx);
          expect(canActivate).toBe(true);
        },
      );

      it.each(['MEMBER', 'VIEWER'])(
        'blocks customer role %s from POST /plans/upgrade with 403 Forbidden via genuine metadata',
        async (role) => {
          const customerUser = {
            id: 'cust-non-admin',
            userType: 'CUSTOMER',
            activeOrganizationId: 'org-1',
          };

          mockPrisma.organizationMember.findUnique.mockResolvedValue({
            organizationId: 'org-1',
            userId: 'cust-non-admin',
            role,
          });

          const ctx = createMockContext(
            CustomerPlansController,
            CustomerPlansController.prototype.upgradePlan,
            customerUser,
            'POST',
          );

          await expect(rolesGuard.canActivate(ctx)).rejects.toThrow(
            ForbiddenException,
          );
        },
      );
    });
  });
});
