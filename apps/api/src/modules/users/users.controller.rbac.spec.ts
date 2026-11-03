import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RolesGuard } from './guards';
import { PrismaService } from '../../common/prisma/prisma.service';

// Regression test for a confirmed account-takeover vulnerability: PATCH /users/:id had no
// @Roles guard, so any authenticated employee (any role) could reset another employee's
// password/status/roleId. The RolesGuard itself is real here (not overridden) — only
// PrismaService's custom-role lookup is mocked — so this exercises the actual authorization
// decision, not just the presence of a decorator.
describe('UsersController RBAC — PATCH /users/:id account-takeover regression', () => {
  let controller: UsersController;
  let guard: RolesGuard;
  let usersService: any;
  let prismaMock: any;

  beforeEach(async () => {
    usersService = {
      updateUser: jest.fn().mockResolvedValue({ id: 'target-1' }),
    };
    prismaMock = {
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: PrismaService, useValue: prismaMock },
        Reflector,
        RolesGuard,
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    guard = module.get<RolesGuard>(RolesGuard);
  });

  function makeContext(user: any) {
    const handler = controller.updateUser;
    return {
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as any;
  }

  it('rejects an authenticated low-privilege employee from updating another user', async () => {
    const ctx = makeContext({ id: 'attacker-1', role: 'EMPLOYEE' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows MANAGER to update a user', async () => {
    const ctx = makeContext({ id: 'manager-1', role: 'MANAGER' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows SUPER_ADMIN to update a user', async () => {
    const ctx = makeContext({ id: 'admin-1', role: 'SUPER_ADMIN' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});

// Regression test for a confirmed PII-exposure finding: GET /users and GET /users/:id had no
// @Roles guard, so RolesGuard's no-decorator fallback (`return true`) let ANY authenticated
// request through with zero role check, including a request whose user object carries no
// recognized staff role at all. These routes are real staff-directory lookups used across many
// admin pages (task/ticket assignment, etc.), so the fix is @Roles(ALL_ROLES) — every real
// staff role can read, matching the read-route convention already used in amc.controller.ts —
// not a management-only restriction, which would have broken those pages.
describe('UsersController RBAC — GET /users and GET /users/:id PII-exposure regression', () => {
  let controller: UsersController;
  let guard: RolesGuard;
  let usersService: any;
  let prismaMock: any;

  beforeEach(async () => {
    usersService = {
      listUsers: jest.fn().mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, hasMore: false },
      }),
      getUserById: jest.fn().mockResolvedValue({ id: 'target-1' }),
    };
    prismaMock = {
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: PrismaService, useValue: prismaMock },
        Reflector,
        RolesGuard,
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    guard = module.get<RolesGuard>(RolesGuard);
  });

  function makeContext(handler: (...args: any[]) => any, user: any) {
    return {
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as any;
  }

  it('rejects an authenticated request with no recognized staff role from listing users', async () => {
    const ctx = makeContext(controller.listUsers, {
      id: 'nobody-1',
      role: undefined,
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('rejects an authenticated request with no recognized staff role from viewing a single user', async () => {
    const ctx = makeContext(controller.getUser, {
      id: 'nobody-1',
      role: undefined,
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows a low-privilege EMPLOYEE to list users (assignment dropdowns must keep working)', async () => {
    const ctx = makeContext(controller.listUsers, {
      id: 'emp-1',
      role: 'EMPLOYEE',
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows a low-privilege EMPLOYEE to view a single user', async () => {
    const ctx = makeContext(controller.getUser, {
      id: 'emp-1',
      role: 'EMPLOYEE',
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows SUPER_ADMIN to list users', async () => {
    const ctx = makeContext(controller.listUsers, {
      id: 'admin-1',
      role: 'SUPER_ADMIN',
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
