import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsRepository } from './projects.repository';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GithubService } from '../github/services/github.service';
import { TasksService } from '../tasks/tasks.service';

describe('ProjectsService (GitHub Binding, In-App Merge Gate & Release Notes)', () => {
  let service: ProjectsService;
  let mockProjectsRepository: any;
  let mockPrisma: any;
  let mockGithubService: any;
  let mockTasksService: any;

  beforeEach(async () => {
    mockProjectsRepository = {
      findById: jest.fn(),
      getProjectStats: jest.fn().mockResolvedValue({
        taskCount: 5,
        totalTimeLogged: 12,
      }),
    };

    mockPrisma = {
      project: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      projectTaskCounter: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      taskPullRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      projectReleaseNote: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
      githubAccount: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    mockGithubService = {
      isGithubAppConfigured: jest.fn().mockReturnValue(true),
      testScopedConnection: jest
        .fn()
        .mockResolvedValue({ slug: 'neuravolt-app' }),
      getAppInstallations: jest.fn().mockResolvedValue([
        {
          id: 12345,
          account: {
            login: 'neuravolt-labs',
            avatar_url: 'https://avatar.url',
            type: 'Organization',
          },
        },
      ]),
      getInstallationRepositories: jest.fn().mockResolvedValue([
        {
          id: 998877,
          name: 'neura-core',
          full_name: 'neuravolt-labs/neura-core',
          private: true,
          default_branch: 'develop',
        },
      ]),
      getRepositoryDetails: jest.fn().mockResolvedValue({
        id: 998877,
        name: 'neura-core',
        full_name: 'neuravolt-labs/neura-core',
        default_branch: 'develop',
      }),
      checkPullRequestMergeability: jest.fn().mockResolvedValue({
        canMerge: true,
        mergeable: true,
        mergeableState: 'clean',
        headSha: 'abc1234',
        title: 'Feature PR',
        state: 'open',
        isMerged: false,
      }),
      mergePullRequest: jest.fn().mockResolvedValue({
        sha: 'merge-commit-sha-999',
        merged: true,
        message: 'Pull Request merged successfully',
        mergedAt: new Date('2026-10-20T12:00:00Z'),
      }),
      searchUsers: jest.fn().mockResolvedValue([
        {
          id: 101,
          login: 'dev-alice',
          avatarUrl: 'https://avatar.url/alice',
          htmlUrl: 'https://github.com/dev-alice',
        },
      ]),
      listCollaborators: jest.fn().mockResolvedValue([
        {
          id: 101,
          username: 'dev-alice',
          role: 'write',
          permissions: { admin: false, push: true, pull: true },
          avatarUrl: 'https://avatar.url/alice',
        },
      ]),
      listInvitations: jest.fn().mockResolvedValue([
        {
          id: 501,
          invitee: 'dev-bob',
          inviter: 'lead-dev',
          permissions: 'write',
          createdAt: new Date(),
        },
      ]),
      inviteCollaborator: jest.fn().mockResolvedValue({
        invitationId: 502,
        invitee: 'dev-charlie',
        permissions: 'push',
        status: 'pending',
      }),
      cancelInvitation: jest.fn().mockResolvedValue(true),
      removeCollaborator: jest.fn().mockResolvedValue(true),
    };

    mockTasksService = {
      updateTaskStatus: jest
        .fn()
        .mockResolvedValue({ id: 'task-1', status: 'review' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: ProjectsRepository, useValue: mockProjectsRepository },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GithubService, useValue: mockGithubService },
        { provide: TasksService, useValue: mockTasksService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('Repository Binding (Phase 1)', () => {
    it('lists available GitHub repositories across installations', async () => {
      const result = await service.listAvailableGithubRepositories();
      expect(result.isConfigured).toBe(true);
      expect(result.installations.length).toBe(1);
      expect(result.installations[0].repositories[0].fullName).toBe(
        'neuravolt-labs/neura-core',
      );
    });

    it('binds GitHub repository to project, saves default branch, and logs audit action', async () => {
      mockProjectsRepository.findById.mockResolvedValue({
        id: 'proj-1',
        name: 'Alpha Project',
        key: 'ALPHA',
        milestones: [],
        tasks: [],
        tickets: [],
      });
      mockPrisma.projectTaskCounter.findUnique.mockResolvedValue({
        lastNumber: 0,
      });

      await service.bindGithubRepository(
        'proj-1',
        {
          installationId: '12345',
          repoFullName: 'neuravolt-labs/neura-core',
        },
        { id: 'user-admin' },
      );

      expect(mockGithubService.getRepositoryDetails).toHaveBeenCalledWith(
        '12345',
        'neuravolt-labs',
        'neura-core',
      );
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: {
          key: 'ALPHA',
          githubRepo: 'neuravolt-labs/neura-core',
          githubRepoId: '998877',
          githubInstallationId: '12345',
          githubDefaultBranch: 'develop',
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PROJECT_GITHUB_BIND',
            resourceType: 'Project',
            resourceId: 'proj-1',
            userId: 'user-admin',
          }),
        }),
      );
    });

    it('unbinds GitHub repository and records audit log', async () => {
      mockProjectsRepository.findById.mockResolvedValue({
        id: 'proj-1',
        name: 'Alpha Project',
        githubRepo: 'neuravolt-labs/neura-core',
        milestones: [],
        tasks: [],
        tickets: [],
      });

      await service.unbindGithubRepository('proj-1', { id: 'user-admin' });

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: {
          githubRepo: null,
          githubRepoId: null,
          githubInstallationId: null,
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PROJECT_GITHUB_UNBIND',
            resourceType: 'Project',
            resourceId: 'proj-1',
          }),
        }),
      );
    });

    it('rejects repository binding when repo format is invalid', async () => {
      mockProjectsRepository.findById.mockResolvedValue({
        id: 'proj-1',
        name: 'Alpha Project',
      });
      await expect(
        service.bindGithubRepository('proj-1', {
          installationId: '12345',
          repoFullName: 'invalid-format-without-slash',
        }),
      ).rejects.toThrow('Invalid repoFullName. Format must be owner/repo.');
    });

    it('rejects binding when project key is already taken by another project', async () => {
      mockProjectsRepository.findById.mockResolvedValue({
        id: 'proj-1',
        name: 'Alpha Project',
      });
      mockPrisma.project.findFirst.mockResolvedValue({
        id: 'other-proj',
        key: 'CORE',
      });

      await expect(
        service.bindGithubRepository('proj-1', {
          installationId: '12345',
          repoFullName: 'neuravolt-labs/neura-core',
          key: 'CORE',
        }),
      ).rejects.toThrow(
        'Project key "CORE" is already assigned to another project.',
      );
    });
  });

  describe('In-App PR Merge Gate (Phase 3)', () => {
    it('delegates mergeability check to GithubService with fresh branch protections', async () => {
      mockProjectsRepository.findById.mockResolvedValue({
        id: 'proj-1',
        githubInstallationId: '12345',
      });
      mockPrisma.taskPullRequest.findUnique.mockResolvedValue({
        id: 'pr-1',
        prNumber: 42,
        repoFullName: 'neuravolt-labs/neura-core',
        task: { projectId: 'proj-1' },
      });

      const result = await service.checkPullRequestMergeability(
        'proj-1',
        'pr-1',
      );

      expect(result.canMerge).toBe(true);
      expect(
        mockGithubService.checkPullRequestMergeability,
      ).toHaveBeenCalledWith('12345', 'neuravolt-labs', 'neura-core', 42);
    });

    it('executes merge, updates TaskPullRequest, and PRESERVES QA WORKFLOW by retaining task in REVIEW', async () => {
      mockProjectsRepository.findById.mockResolvedValue({
        id: 'proj-1',
        githubInstallationId: '12345',
        name: 'Core System',
        key: 'CORE',
      });
      mockPrisma.taskPullRequest.findUnique.mockResolvedValue({
        id: 'pr-1',
        prNumber: 42,
        repoFullName: 'neuravolt-labs/neura-core',
        taskId: 'task-100',
        task: { id: 'task-100', projectId: 'proj-1', status: 'IN_PROGRESS' },
      });
      mockPrisma.taskPullRequest.update.mockResolvedValue({
        id: 'pr-1',
        isMerged: true,
        status: 'MERGED',
      });
      mockPrisma.projectReleaseNote.findFirst.mockResolvedValue(null);
      mockPrisma.projectReleaseNote.create.mockResolvedValue({
        id: 'rel-draft-1',
      });

      const result = await service.mergeProjectPullRequest('proj-1', 'pr-1', {
        id: 'mgr-1',
      });

      expect(result.success).toBe(true);
      expect(mockGithubService.mergePullRequest).toHaveBeenCalledWith(
        '12345',
        'neuravolt-labs',
        'neura-core',
        42,
        undefined,
      );
      // Status update MUST NOT mark task DONE! Retains in review for QA testing.
      expect(mockTasksService.updateTaskStatus).toHaveBeenCalledWith(
        'task-100',
        { status: 'review' },
      );
      expect(mockTasksService.updateTaskStatus).not.toHaveBeenCalledWith(
        'task-100',
        { status: 'done' },
      );
      // Audit log recorded
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PROJECT_PR_MERGE',
            resourceId: 'proj-1',
            userId: 'mgr-1',
          }),
        }),
      );
    });
  });

  describe('Draft Release Notes Generator & Publishing (Phase 3)', () => {
    it('generates sanitized, unpublished release draft from merged PRs', async () => {
      mockProjectsRepository.findById.mockResolvedValue({
        id: 'proj-1',
        name: 'NeuraVolt Core',
        key: 'CORE',
      });
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Implement OAuth <script>alert(1)</script>',
          taskCode: 'CORE-10',
          pullRequests: [
            {
              id: 'pr-1',
              prNumber: 5,
              prTitle:
                'Add Google OAuth support <script>alert(1)</script> commit: 9f8a32b1234cdef',
              prUrl: 'https://github.com/internal-org/secret-repo/pull/5',
              isMerged: true,
            },
          ],
        },
      ]);
      mockPrisma.projectReleaseNote.findFirst.mockResolvedValue(null);
      mockPrisma.projectReleaseNote.create.mockResolvedValue({
        id: 'draft-1',
        isPublished: false,
      });

      const draft = await service.generateDraftReleaseNote('proj-1', {
        id: 'mgr-1',
      });

      expect(draft.id).toBe('draft-1');
      // Verifies sanitization (HTML stripped, commit SHA stripped, private URL not leaked) and unpublished state
      expect(mockPrisma.projectReleaseNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'proj-1',
            isPublished: false,
            summary: expect.not.stringContaining('<script>'),
          }),
        }),
      );
      const callData =
        mockPrisma.projectReleaseNote.create.mock.calls[0][0].data;
      expect(callData.summary).not.toContain('9f8a32b1234cdef');
      expect(callData.summary).not.toContain('internal-org/secret-repo');
      expect(callData.summary).toContain('(PR #5)');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PROJECT_RELEASE_NOTE_DRAFT_CREATED',
          }),
        }),
      );
    });

    it('sanitizes developer email addresses and git trailers from release note drafts', async () => {
      mockProjectsRepository.findById.mockResolvedValue({
        id: 'proj-1',
        key: 'TEST',
        name: 'Test App',
      });
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-privacy-1',
          title: 'Database connection pool tuning',
          taskCode: 'CORE-22',
          pullRequests: [
            {
              id: 'pr-2',
              prNumber: 8,
              prTitle:
                'Optimize pool by dev.lead@internal.company.com Co-authored-by: engineer@sec.org',
              prUrl: 'https://github.com/org/repo/pull/8',
              isMerged: true,
            },
          ],
        },
      ]);
      mockPrisma.projectReleaseNote.findFirst.mockResolvedValue(null);
      mockPrisma.projectReleaseNote.create.mockResolvedValue({
        id: 'draft-privacy-1',
        isPublished: false,
      });

      await service.generateDraftReleaseNote('proj-1', { id: 'mgr-1' });

      const createdNote =
        mockPrisma.projectReleaseNote.create.mock.calls[0][0].data;
      expect(createdNote.summary).not.toContain(
        'dev.lead@internal.company.com',
      );
      expect(createdNote.summary).not.toContain('engineer@sec.org');
      expect(createdNote.summary).toContain('Optimize pool by');
    });

    it('publishes release note only after authorized manager approval', async () => {
      mockProjectsRepository.findById.mockResolvedValue({ id: 'proj-1' });
      mockPrisma.projectReleaseNote.findFirst.mockResolvedValue({
        id: 'draft-1',
        projectId: 'proj-1',
        isPublished: false,
        title: 'Release Notes - v1.0',
      });
      mockPrisma.projectReleaseNote.update.mockResolvedValue({
        id: 'draft-1',
        isPublished: true,
        publishedAt: new Date(),
        publishedById: 'mgr-1',
      });

      const published = await service.publishReleaseNote('proj-1', 'draft-1', {
        id: 'mgr-1',
      });

      expect(published.isPublished).toBe(true);
      expect(mockPrisma.projectReleaseNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'draft-1' },
          data: expect.objectContaining({
            isPublished: true,
            publishedById: 'mgr-1',
          }),
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PROJECT_RELEASE_NOTE_PUBLISHED',
            userId: 'mgr-1',
          }),
        }),
      );
    });
  });

  describe('Collaborator Access Management', () => {
    const mockBoundProject = {
      id: 'proj-1',
      name: 'Alpha Project',
      githubRepo: 'neuravolt/core',
      githubInstallationId: 'inst-12345',
    };

    it('lists collaborators and invitations for a connected repository', async () => {
      mockProjectsRepository.findById.mockResolvedValue(mockBoundProject);

      const result = await service.listProjectCollaborators('proj-1');

      expect(result.collaborators).toHaveLength(1);
      expect(result.collaborators[0].username).toBe('dev-alice');
      expect(result.invitations).toHaveLength(1);
      expect(result.invitations[0].invitee).toBe('dev-bob');
      expect(mockGithubService.listCollaborators).toHaveBeenCalledWith(
        'inst-12345',
        'neuravolt',
        'core',
      );
      expect(mockGithubService.listInvitations).toHaveBeenCalledWith(
        'inst-12345',
        'neuravolt',
        'core',
      );
    });

    it('rejects listing collaborators if project has no connected repository', async () => {
      mockProjectsRepository.findById.mockResolvedValue({
        id: 'proj-unbound',
        githubRepo: null,
      });

      await expect(
        service.listProjectCollaborators('proj-unbound'),
      ).rejects.toThrow(BadRequestException);
    });

    it('searches developers by GitHub username', async () => {
      mockProjectsRepository.findById.mockResolvedValue(mockBoundProject);

      const results = await service.searchProjectCollaborators(
        'proj-1',
        'alice',
      );

      expect(results).toHaveLength(1);
      expect(results[0].login).toBe('dev-alice');
      expect(mockGithubService.searchUsers).toHaveBeenCalledWith(
        'inst-12345',
        'alice',
      );
    });

    it('invites a developer defaulting to push (write) permissions (never admin)', async () => {
      mockProjectsRepository.findById.mockResolvedValue(mockBoundProject);

      const result = await service.inviteProjectCollaborator(
        'proj-1',
        { username: 'dev-charlie' }, // No permission specified -> defaults to push
        { id: 'mgr-1' },
      );

      expect(result.success).toBe(true);
      expect(result.permission).toBe('push');
      expect(mockGithubService.inviteCollaborator).toHaveBeenCalledWith(
        'inst-12345',
        'neuravolt',
        'core',
        'dev-charlie',
        'push',
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PROJECT_GITHUB_COLLABORATOR_INVITED',
            userId: 'mgr-1',
          }),
        }),
      );
    });

    it('rejects invitation if username is empty', async () => {
      mockProjectsRepository.findById.mockResolvedValue(mockBoundProject);

      await expect(
        service.inviteProjectCollaborator(
          'proj-1',
          { username: '   ' } as any,
          { id: 'mgr-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('cancels pending invitation and records audit log', async () => {
      mockProjectsRepository.findById.mockResolvedValue(mockBoundProject);

      const result = await service.cancelProjectInvitation('proj-1', 501, {
        id: 'mgr-1',
      });

      expect(result.success).toBe(true);
      expect(mockGithubService.cancelInvitation).toHaveBeenCalledWith(
        'inst-12345',
        'neuravolt',
        'core',
        501,
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PROJECT_GITHUB_INVITATION_CANCELLED',
            userId: 'mgr-1',
          }),
        }),
      );
    });

    it('removes a developer collaborator and records audit log', async () => {
      mockProjectsRepository.findById.mockResolvedValue(mockBoundProject);

      const result = await service.removeProjectCollaborator(
        'proj-1',
        'dev-alice',
        { id: 'mgr-1' },
      );

      expect(result.success).toBe(true);
      expect(mockGithubService.removeCollaborator).toHaveBeenCalledWith(
        'inst-12345',
        'neuravolt',
        'core',
        'dev-alice',
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PROJECT_GITHUB_COLLABORATOR_REMOVED',
            userId: 'mgr-1',
          }),
        }),
      );
    });
  });
});
