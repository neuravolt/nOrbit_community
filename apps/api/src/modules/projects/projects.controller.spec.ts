import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { Roles } from '../users/guards/roles.guard';
import { Permissions } from '../roles/guards/permissions.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('ProjectsController Authorization & Guard Metadata', () => {
  let controller: ProjectsController;
  let mockProjectsService: any;
  let reflector: Reflector;

  beforeEach(async () => {
    mockProjectsService = {
      bindGithubRepository: jest.fn().mockResolvedValue({ id: 'proj-1' }),
      unbindGithubRepository: jest.fn().mockResolvedValue({ id: 'proj-1' }),
      listAvailableGithubRepositories: jest
        .fn()
        .mockResolvedValue({ isConfigured: true, installations: [] }),
      checkPullRequestMergeability: jest
        .fn()
        .mockResolvedValue({ canMerge: true, mergeable: true }),
      mergeProjectPullRequest: jest
        .fn()
        .mockResolvedValue({ success: true, merged: true }),
      getProjectReleaseNotes: jest.fn().mockResolvedValue([]),
      generateDraftReleaseNote: jest
        .fn()
        .mockResolvedValue({ id: 'rn-1', isPublished: false }),
      publishReleaseNote: jest
        .fn()
        .mockResolvedValue({ id: 'rn-1', isPublished: true }),
      listProjectCollaborators: jest
        .fn()
        .mockResolvedValue({ collaborators: [], invitations: [] }),
      searchProjectCollaborators: jest.fn().mockResolvedValue([]),
      inviteProjectCollaborator: jest.fn().mockResolvedValue({ success: true }),
      cancelProjectInvitation: jest.fn().mockResolvedValue({ success: true }),
      removeProjectCollaborator: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
    reflector = module.get<Reflector>(Reflector);
  });

  it('restricts bindGithubRepository to SUPER_ADMIN and MANAGER with projects:update permission', () => {
    const roles = reflector.get(Roles, controller.bindGithubRepository);
    const permissions = reflector.get(
      Permissions,
      controller.bindGithubRepository,
    );

    expect(roles).toEqual(['SUPER_ADMIN', 'MANAGER']);
    expect(permissions).toEqual(['projects:update']);
    expect(roles).not.toContain('DEVELOPER');
    expect(roles).not.toContain('QA');
    expect(roles).not.toContain('EMPLOYEE');
  });

  it('restricts unbindGithubRepository to SUPER_ADMIN and MANAGER with projects:update permission', () => {
    const roles = reflector.get(Roles, controller.unbindGithubRepository);
    const permissions = reflector.get(
      Permissions,
      controller.unbindGithubRepository,
    );

    expect(roles).toEqual(['SUPER_ADMIN', 'MANAGER']);
    expect(permissions).toEqual(['projects:update']);
    expect(roles).not.toContain('DEVELOPER');
    expect(roles).not.toContain('QA');
  });

  it('delegates bindGithubRepository to service with user context', async () => {
    const mockUser = { id: 'usr-admin', role: 'MANAGER' };
    const dto = { installationId: 'inst-1', repoFullName: 'org/repo' };

    await controller.bindGithubRepository('proj-1', dto, { user: mockUser });

    expect(mockProjectsService.bindGithubRepository).toHaveBeenCalledWith(
      'proj-1',
      dto,
      mockUser,
    );
  });

  it('delegates unbindGithubRepository to service with user context', async () => {
    const mockUser = { id: 'usr-admin', role: 'MANAGER' };

    await controller.unbindGithubRepository('proj-1', { user: mockUser });

    expect(mockProjectsService.unbindGithubRepository).toHaveBeenCalledWith(
      'proj-1',
      mockUser,
    );
  });

  it('allows developers and QA to read mergeability status', async () => {
    const roles = reflector.get(Roles, controller.checkPullRequestMergeability);
    const permissions = reflector.get(
      Permissions,
      controller.checkPullRequestMergeability,
    );

    expect(roles).toEqual(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA']);
    expect(permissions).toEqual(['projects:read']);

    await controller.checkPullRequestMergeability('proj-1', 'pr-123');
    expect(
      mockProjectsService.checkPullRequestMergeability,
    ).toHaveBeenCalledWith('proj-1', 'pr-123');
  });

  it('restricts mergeProjectPullRequest to SUPER_ADMIN and MANAGER with projects:update', async () => {
    const roles = reflector.get(Roles, controller.mergeProjectPullRequest);
    const permissions = reflector.get(
      Permissions,
      controller.mergeProjectPullRequest,
    );

    expect(roles).toEqual(['SUPER_ADMIN', 'MANAGER']);
    expect(permissions).toEqual(['projects:update']);
    expect(roles).not.toContain('DEVELOPER');
    expect(roles).not.toContain('QA');
    expect(roles).not.toContain('EMPLOYEE');

    const mockUser = { id: 'usr-mgr', role: 'MANAGER' };
    const body = { mergeMethod: 'squash', commitTitle: 'feat: new feature' };
    await controller.mergeProjectPullRequest('proj-1', 'pr-123', body, {
      user: mockUser,
    });

    expect(mockProjectsService.mergeProjectPullRequest).toHaveBeenCalledWith(
      'proj-1',
      'pr-123',
      mockUser,
      body,
    );
  });

  it('allows team members to read release notes', async () => {
    const roles = reflector.get(Roles, controller.getProjectReleaseNotes);
    const permissions = reflector.get(
      Permissions,
      controller.getProjectReleaseNotes,
    );

    expect(roles).toEqual([
      'SUPER_ADMIN',
      'MANAGER',
      'DEVELOPER',
      'QA',
      'EMPLOYEE',
    ]);
    expect(permissions).toEqual(['projects:read']);

    await controller.getProjectReleaseNotes('proj-1');
    expect(mockProjectsService.getProjectReleaseNotes).toHaveBeenCalledWith(
      'proj-1',
    );
  });

  it('restricts generateDraftReleaseNote to SUPER_ADMIN and MANAGER', async () => {
    const roles = reflector.get(Roles, controller.generateDraftReleaseNote);
    const permissions = reflector.get(
      Permissions,
      controller.generateDraftReleaseNote,
    );

    expect(roles).toEqual(['SUPER_ADMIN', 'MANAGER']);
    expect(permissions).toEqual(['projects:update']);
    expect(roles).not.toContain('DEVELOPER');

    const mockUser = { id: 'usr-mgr', role: 'MANAGER' };
    await controller.generateDraftReleaseNote('proj-1', { user: mockUser });
    expect(mockProjectsService.generateDraftReleaseNote).toHaveBeenCalledWith(
      'proj-1',
      mockUser,
    );
  });

  it('restricts publishReleaseNote to SUPER_ADMIN and MANAGER', async () => {
    const roles = reflector.get(Roles, controller.publishReleaseNote);
    const permissions = reflector.get(
      Permissions,
      controller.publishReleaseNote,
    );

    expect(roles).toEqual(['SUPER_ADMIN', 'MANAGER']);
    expect(permissions).toEqual(['projects:update']);
    expect(roles).not.toContain('DEVELOPER');

    const mockUser = { id: 'usr-mgr', role: 'MANAGER' };
    await controller.publishReleaseNote('proj-1', 'rn-1', { user: mockUser });
    expect(mockProjectsService.publishReleaseNote).toHaveBeenCalledWith(
      'proj-1',
      'rn-1',
      mockUser,
    );
  });

  describe('Collaborator Access Management RBAC', () => {
    it('allows SUPER_ADMIN, MANAGER, DEVELOPER, QA to list collaborators with projects:read', async () => {
      const roles = reflector.get(Roles, controller.listProjectCollaborators);
      const permissions = reflector.get(
        Permissions,
        controller.listProjectCollaborators,
      );

      expect(roles).toEqual(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA']);
      expect(permissions).toEqual(['projects:read']);

      await controller.listProjectCollaborators('proj-1');
      expect(mockProjectsService.listProjectCollaborators).toHaveBeenCalledWith(
        'proj-1',
      );
    });

    it('restricts searchProjectCollaborators to SUPER_ADMIN and MANAGER with projects:update', async () => {
      const roles = reflector.get(Roles, controller.searchProjectCollaborators);
      const permissions = reflector.get(
        Permissions,
        controller.searchProjectCollaborators,
      );

      expect(roles).toEqual(['SUPER_ADMIN', 'MANAGER']);
      expect(permissions).toEqual(['projects:update']);
      expect(roles).not.toContain('DEVELOPER');

      await controller.searchProjectCollaborators('proj-1', 'dev-alice');
      expect(
        mockProjectsService.searchProjectCollaborators,
      ).toHaveBeenCalledWith('proj-1', 'dev-alice');
    });

    it('restricts inviteProjectCollaborator to SUPER_ADMIN and MANAGER with projects:update', async () => {
      const roles = reflector.get(Roles, controller.inviteProjectCollaborator);
      const permissions = reflector.get(
        Permissions,
        controller.inviteProjectCollaborator,
      );

      expect(roles).toEqual(['SUPER_ADMIN', 'MANAGER']);
      expect(permissions).toEqual(['projects:update']);
      expect(roles).not.toContain('DEVELOPER');

      const mockUser = { id: 'usr-mgr', role: 'MANAGER' };
      const dto = { username: 'dev-alice', permission: 'push' as const };
      await controller.inviteProjectCollaborator('proj-1', dto, {
        user: mockUser,
      });
      expect(
        mockProjectsService.inviteProjectCollaborator,
      ).toHaveBeenCalledWith('proj-1', dto, mockUser);
    });

    it('restricts cancelProjectInvitation to SUPER_ADMIN and MANAGER with projects:update', async () => {
      const roles = reflector.get(Roles, controller.cancelProjectInvitation);
      const permissions = reflector.get(
        Permissions,
        controller.cancelProjectInvitation,
      );

      expect(roles).toEqual(['SUPER_ADMIN', 'MANAGER']);
      expect(permissions).toEqual(['projects:update']);
      expect(roles).not.toContain('DEVELOPER');

      const mockUser = { id: 'usr-mgr', role: 'MANAGER' };
      await controller.cancelProjectInvitation('proj-1', '12345', {
        user: mockUser,
      });
      expect(mockProjectsService.cancelProjectInvitation).toHaveBeenCalledWith(
        'proj-1',
        12345,
        mockUser,
      );
    });

    it('restricts removeProjectCollaborator to SUPER_ADMIN and MANAGER with projects:update', async () => {
      const roles = reflector.get(Roles, controller.removeProjectCollaborator);
      const permissions = reflector.get(
        Permissions,
        controller.removeProjectCollaborator,
      );

      expect(roles).toEqual(['SUPER_ADMIN', 'MANAGER']);
      expect(permissions).toEqual(['projects:update']);
      expect(roles).not.toContain('DEVELOPER');

      const mockUser = { id: 'usr-mgr', role: 'MANAGER' };
      await controller.removeProjectCollaborator('proj-1', 'dev-alice', {
        user: mockUser,
      });
      expect(
        mockProjectsService.removeProjectCollaborator,
      ).toHaveBeenCalledWith('proj-1', 'dev-alice', mockUser);
    });
  });
});
