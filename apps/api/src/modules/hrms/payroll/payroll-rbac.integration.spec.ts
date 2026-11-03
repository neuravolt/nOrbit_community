import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../users/guards/roles.guard';
import { PayrollController } from './payroll.controller';

// P1 gap-closure — RBAC tests. Not structural (grep-checking @Roles exists);
// this drives the REAL RolesGuard.canActivate() against the REAL metadata
// Nest attaches to REAL PayrollController methods, via a hand-built
// ExecutionContext. This is the same mechanism Nest itself uses at request
// time (context.getHandler() -> Reflector.get(Roles, handler)) minus the
// HTTP transport — an integration-level test of the actual authorization
// decision, not an assertion that a decorator is merely present.
describe('PayrollController RBAC (integration)', () => {
  let guard: RolesGuard;
  let prismaMock: any;

  function contextFor(
    handler: Function,
    role: string,
    userId = 'user-1',
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => PayrollController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: userId, role } }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    prismaMock = { userRole: { findMany: jest.fn().mockResolvedValue([]) } };
    guard = new RolesGuard(new Reflector(), prismaMock);
  });

  describe('unauthorized role is rejected', () => {
    const STAFF_BLOCKED_ROUTES: Array<[string, Function]> = [
      ['list salary components', PayrollController.prototype.listComponents],
      ['create salary component', PayrollController.prototype.createComponent],
      ['create tax config', PayrollController.prototype.createTaxConfig],
      ['update tax config', PayrollController.prototype.updateTaxConfig],
      [
        'update employee override',
        PayrollController.prototype.updateEmployeeOverrides,
      ],
      ['run migration', PayrollController.prototype.runMigration],
      ['approve payroll run', PayrollController.prototype.approveRun],
      ['finalize payroll run', PayrollController.prototype.finalizeRun],
      ['lock payroll run', PayrollController.prototype.lockRun],
    ];

    for (const [label, handler] of STAFF_BLOCKED_ROUTES) {
      it(`a plain STAFF role is rejected from: ${label}`, async () => {
        await expect(
          guard.canActivate(contextFor(handler, 'STAFF')),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    }
  });

  describe('authorized role is allowed', () => {
    it('SUPER_ADMIN is allowed on every route (universal bypass)', async () => {
      const routes = [
        PayrollController.prototype.createComponent,
        PayrollController.prototype.createTaxConfig,
        PayrollController.prototype.updateTaxConfig,
        PayrollController.prototype.updateEmployeeOverrides,
        PayrollController.prototype.runMigration,
        PayrollController.prototype.lockRun,
        PayrollController.prototype.calculateRun,
      ];
      for (const handler of routes) {
        await expect(
          guard.canActivate(contextFor(handler, 'SUPER_ADMIN')),
        ).resolves.toBe(true);
      }
    });

    it('MANAGER is allowed on day-to-day workflow routes', async () => {
      await expect(
        guard.canActivate(
          contextFor(PayrollController.prototype.calculateRun, 'MANAGER'),
        ),
      ).resolves.toBe(true);
      await expect(
        guard.canActivate(
          contextFor(PayrollController.prototype.approveRun, 'MANAGER'),
        ),
      ).resolves.toBe(true);
      await expect(
        guard.canActivate(
          contextFor(PayrollController.prototype.finalizeRun, 'MANAGER'),
        ),
      ).resolves.toBe(true);
      await expect(
        guard.canActivate(
          contextFor(PayrollController.prototype.listComponents, 'MANAGER'),
        ),
      ).resolves.toBe(true);
    });
  });

  describe('sensitive operations require SUPER_ADMIN specifically — MANAGER is not enough', () => {
    const STATUTORY_ONLY_ROUTES: Array<[string, Function]> = [
      ['create salary component', PayrollController.prototype.createComponent],
      ['update salary component', PayrollController.prototype.updateComponent],
      [
        'deactivate salary component',
        PayrollController.prototype.deactivateComponent,
      ],
      ['create tax config', PayrollController.prototype.createTaxConfig],
      ['update tax config', PayrollController.prototype.updateTaxConfig],
      [
        'update employee statutory override',
        PayrollController.prototype.updateEmployeeOverrides,
      ],
      [
        'update employee component override',
        PayrollController.prototype.updateComponentOverride,
      ],
      [
        'run legacy-to-dynamic migration',
        PayrollController.prototype.runMigration,
      ],
      ['lock a finalized payroll run', PayrollController.prototype.lockRun],
    ];

    for (const [label, handler] of STATUTORY_ONLY_ROUTES) {
      it(`MANAGER is rejected from: ${label}`, async () => {
        await expect(
          guard.canActivate(contextFor(handler, 'MANAGER')),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it(`SUPER_ADMIN is allowed to: ${label}`, async () => {
        await expect(
          guard.canActivate(contextFor(handler, 'SUPER_ADMIN')),
        ).resolves.toBe(true);
      });
    }
  });

  describe('unauthenticated request is rejected', () => {
    it('throws when there is no user on the request at all', async () => {
      const context = {
        getHandler: () => PayrollController.prototype.listComponents,
        getClass: () => PayrollController,
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as unknown as ExecutionContext;
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
