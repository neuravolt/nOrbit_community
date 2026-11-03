import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GithubSettingsController } from './github-settings.controller';
import { GithubService } from '../services/github.service';
import { RolesGuard } from '../../users/guards/roles.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('GithubSettingsController (Super Admin Centralized GitHub Settings)', () => {
  let controller: GithubSettingsController;
  let githubService: jest.Mocked<GithubService>;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockMaskedSettingsProjects = {
    scope: 'PROJECTS',
    appId: '112233',
    appName: 'neuravolt-os-projects',
    isPrivateKeyConfigured: true,
    isWebhookSecretConfigured: true,
    source: 'DATABASE_ENCRYPTED',
    hasRollback: false,
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestMessage: null,
    webhookUrl: 'https://teams.neuravolt.in/api/v1/github/webhook/project',
    legacySharedWebhookUrl:
      'https://teams.neuravolt.in/api/launchpad/github/webhook',
    callbackUrl: 'https://teams.neuravolt.in/api/v1/auth/github/callback',
  };

  const mockMaskedSettingsLaunchpad = {
    scope: 'LAUNCHPAD',
    appId: '889900',
    appName: 'neuravolt-launchpad',
    isPrivateKeyConfigured: true,
    isWebhookSecretConfigured: true,
    source: 'ENVIRONMENT',
    hasRollback: true,
    lastTestedAt: '2026-10-20T12:00:00Z',
    lastTestStatus: 'SUCCESS',
    lastTestMessage: 'Connected as "neuravolt-launchpad"',
    webhookUrl: 'https://teams.neuravolt.in/api/launchpad/github/webhook',
    legacySharedWebhookUrl:
      'https://teams.neuravolt.in/api/launchpad/github/webhook',
    callbackUrl: 'https://teams.neuravolt.in/api/v1/auth/github/callback',
  };

  beforeEach(async () => {
    const mockGithubService = {
      getSettingsView: jest.fn(),
      updateSettings: jest.fn(),
      rollbackSettings: jest.fn(),
      testScopedConnection: jest.fn(),
    };

    const mockPrisma = {
      userRole: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GithubSettingsController],
      providers: [
        { provide: GithubService, useValue: mockGithubService },
        { provide: PrismaService, useValue: mockPrisma },
        Reflector,
        RolesGuard,
      ],
    }).compile();

    controller = module.get<GithubSettingsController>(GithubSettingsController);
    githubService = module.get(GithubService);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('Scoped Settings View (GET /settings/integrations/github)', () => {
    it('1. should return masked settings for default scope (PROJECTS)', async () => {
      githubService.getSettingsView.mockResolvedValue(
        mockMaskedSettingsProjects as any,
      );

      const res = await controller.getSettings();
      expect(githubService.getSettingsView).toHaveBeenCalledWith('PROJECTS');
      expect(res).toEqual(mockMaskedSettingsProjects);
      expect((res as any).privateKey).toBeUndefined();
      expect((res as any).privateKeyEnc).toBeUndefined();
      expect((res as any).webhookSecret).toBeUndefined();
      expect((res as any).webhookSecretEnc).toBeUndefined();
    });

    it('2. should return masked settings for LAUNCHPAD scope when requested', async () => {
      githubService.getSettingsView.mockResolvedValue(
        mockMaskedSettingsLaunchpad as any,
      );

      const res = await controller.getSettings('LAUNCHPAD');
      expect(githubService.getSettingsView).toHaveBeenCalledWith('LAUNCHPAD');
      expect(res).toEqual(mockMaskedSettingsLaunchpad);
      expect(res.webhookUrl).toContain('/api/launchpad/github/webhook');
    });

    it('3. should reject invalid integration scope with BadRequestException', async () => {
      await expect(
        controller.getSettings('INVALID_SCOPE' as any),
      ).rejects.toThrow(BadRequestException);
      expect(githubService.getSettingsView).not.toHaveBeenCalled();
    });
  });

  describe('Update Settings (POST /settings/integrations/github)', () => {
    it('4. should delegate update to githubService with validated scope and user', async () => {
      githubService.updateSettings.mockResolvedValue(
        mockMaskedSettingsProjects as any,
      );
      const req = {
        user: {
          id: 'admin-1',
          email: 'admin@neuravolt.com',
          role: 'SUPER_ADMIN',
        },
      };
      const dto = {
        scope: 'PROJECTS' as const,
        appId: '12345',
        appName: 'neuravolt-os-projects',
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...',
        webhookSecret: 'super-secret',
      };

      const res = await controller.updateSettings(dto, req);
      expect(githubService.updateSettings).toHaveBeenCalledWith(
        'PROJECTS',
        {
          appId: '12345',
          appName: 'neuravolt-os-projects',
          privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...',
          webhookSecret: 'super-secret',
        },
        req.user,
      );
      expect(res).toEqual(mockMaskedSettingsProjects);
    });

    it('5. should reject update with invalid scope', async () => {
      const req = { user: { id: 'admin-1', role: 'SUPER_ADMIN' } };
      await expect(
        controller.updateSettings(
          { scope: 'UNKNOWN' as any, appId: '123' },
          req,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Test Connection (POST /settings/integrations/github/test)', () => {
    it('6. should test connection for the specified scope', async () => {
      githubService.testScopedConnection.mockResolvedValue({
        success: true,
        message:
          'Connected as "neuravolt-os-projects" (slug: neuravolt-os-projects).',
        slug: 'neuravolt-os-projects',
      });

      const res = await controller.testConnection({ scope: 'PROJECTS' });
      expect(githubService.testScopedConnection).toHaveBeenCalledWith(
        'PROJECTS',
      );
      expect(res.success).toBe(true);
      expect(res.slug).toBe('neuravolt-os-projects');
    });

    it('7. should handle failed connection test without claiming false success', async () => {
      githubService.testScopedConnection.mockResolvedValue({
        success: false,
        message:
          'GitHub rejected credentials (HTTP 401). Verify App ID and Private Key.',
      });

      const res = await controller.testConnection({ scope: 'PROJECTS' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('401');
    });
  });

  describe('Rollback Settings (POST /settings/integrations/github/rollback)', () => {
    it('8. should delegate rollback to githubService with scope and adminUser', async () => {
      githubService.rollbackSettings.mockResolvedValue(
        mockMaskedSettingsProjects as any,
      );
      const req = { user: { id: 'admin-1', role: 'SUPER_ADMIN' } };

      const res = await controller.rollbackSettings({ scope: 'PROJECTS' }, req);
      expect(githubService.rollbackSettings).toHaveBeenCalledWith(
        'PROJECTS',
        req.user,
      );
      expect(res).toEqual(mockMaskedSettingsProjects);
    });
  });

  describe('Strict SUPER_ADMIN Authorization & RBAC', () => {
    function createMockContext(user: any, handler: Function): ExecutionContext {
      return {
        getHandler: () => handler,
        getClass: () => GithubSettingsController,
        switchToHttp: () => ({
          getRequest: () => ({ user }),
          getResponse: () => ({}),
        }),
      } as unknown as ExecutionContext;
    }

    it('9. should allow SUPER_ADMIN user', async () => {
      const superAdminUser = {
        id: 'sa-1',
        email: 'sa@neuravolt.com',
        role: 'SUPER_ADMIN',
      };
      const ctx = createMockContext(superAdminUser, controller.getSettings);
      const canActivate = await rolesGuard.canActivate(ctx);
      expect(canActivate).toBe(true);
    });

    it('10. should reject DEVELOPER role with ForbiddenException', async () => {
      const devUser = {
        id: 'dev-1',
        email: 'dev@neuravolt.com',
        role: 'DEVELOPER',
      };
      const ctx = createMockContext(devUser, controller.getSettings);
      await expect(rolesGuard.canActivate(ctx)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('11. should reject MANAGER role with ForbiddenException', async () => {
      const mgrUser = {
        id: 'mgr-1',
        email: 'mgr@neuravolt.com',
        role: 'MANAGER',
      };
      const ctx = createMockContext(mgrUser, controller.updateSettings);
      await expect(rolesGuard.canActivate(ctx)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('12. should reject QA role with ForbiddenException', async () => {
      const qaUser = { id: 'qa-1', email: 'qa@neuravolt.com', role: 'QA' };
      const ctx = createMockContext(qaUser, controller.testConnection);
      await expect(rolesGuard.canActivate(ctx)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('13. should reject STUDENT / unauthenticated request with ForbiddenException', async () => {
      const ctx = createMockContext(null, controller.rollbackSettings);
      await expect(rolesGuard.canActivate(ctx)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
