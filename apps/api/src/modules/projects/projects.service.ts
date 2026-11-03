import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { ProjectsRepository } from './projects.repository';
import {
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
  ListProjectsQuery,
  CreateMilestoneDto,
  UpdateMilestoneDto,
  ProjectDto,
  ListProjectsResponseDto,
  MilestoneDto,
} from './dto';
import { BindProjectGithubDto } from './dto/bind-project-github.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GithubService } from '../github/services/github.service';
import { TasksService } from '../tasks/tasks.service';
import { PlansEnforcementService } from '../plans/plans-enforcement.service';

@Injectable()
export class ProjectsService {
  private readonly VALID_STATUSES = [
    'PLANNING',
    'ACTIVE',
    'ON_HOLD',
    'COMPLETED',
    'CANCELLED',
  ];
  private readonly MILESTONE_STATUSES = [
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'BLOCKED',
  ];

  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly tasksService: TasksService,
    @Optional()
    private readonly plansEnforcementService?: PlansEnforcementService,
  ) {}

  async createProject(
    createProjectDto: CreateProjectDto,
    user?: any,
  ): Promise<ProjectDto> {
    // Validate date range
    if (createProjectDto.startDate && createProjectDto.endDate) {
      if (
        new Date(createProjectDto.endDate) <=
        new Date(createProjectDto.startDate)
      ) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    // Validate budget is positive if provided
    if (createProjectDto.budget && createProjectDto.budget < 0) {
      throw new BadRequestException('Budget must be a positive number');
    }

    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    if (orgId && this.plansEnforcementService) {
      await this.plansEnforcementService.assertCanCreateProject(orgId);
    }

    const project = await this.projectsRepository.create(
      createProjectDto,
      orgId,
    );
    const stats = await this.projectsRepository.getProjectStats(project.id);

    return this.mapToProjectDto(project, stats);
  }

  private canViewFinancials(user?: any): boolean {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'MANAGER') return true;
    const userPerms = user.permissions || [];
    return (
      userPerms.includes('projects:read_financials') ||
      userPerms.includes('project:read_financials')
    );
  }

  async listProjects(
    query: ListProjectsQuery,
    user?: any,
  ): Promise<ListProjectsResponseDto> {
    // Validate status if provided
    if (query.status && !this.VALID_STATUSES.includes(query.status)) {
      throw new BadRequestException(
        `Invalid status. Valid options: ${this.VALID_STATUSES.join(', ')}`,
      );
    }

    const showFinancials = this.canViewFinancials(user);
    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const result = await this.projectsRepository.findAll(query, orgId);

    const projectsWithStats = await Promise.all(
      result.projects.map(async (p: any) => {
        const stats = await this.projectsRepository.getProjectStats(p.id);
        return {
          id: p.id,
          clientId: p.clientId,
          client: p.client,
          name: p.name,
          status: p.status,
          key: p.key || undefined,
          githubRepo: p.githubRepo || undefined,
          startDate: p.startDate,
          endDate: p.endDate,
          budget: showFinancials ? p.budget : undefined,
          milestoneCount: p.milestones?.length || 0,
          taskCount: stats.taskCount,
          createdAt: p.createdAt,
        };
      }),
    );

    return {
      projects: projectsWithStats,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getProjectById(id: string, user?: any): Promise<ProjectDto> {
    const project = await this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    const stats = await this.projectsRepository.getProjectStats(id);
    return this.mapToProjectDto(project, stats, user);
  }

  async updateProject(
    id: string,
    updateProjectDto: UpdateProjectDto,
    user?: any,
  ): Promise<ProjectDto> {
    const project = await this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    // Validate date range
    const startDate = updateProjectDto.startDate || project.startDate;
    const endDate = updateProjectDto.endDate || project.endDate;

    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate budget is positive if provided
    if (updateProjectDto.budget && updateProjectDto.budget < 0) {
      throw new BadRequestException('Budget must be a positive number');
    }

    const updated = await this.projectsRepository.update(id, updateProjectDto);
    const stats = await this.projectsRepository.getProjectStats(id);

    return this.mapToProjectDto(updated, stats, user);
  }

  async updateProjectStatus(
    id: string,
    updateProjectStatusDto: UpdateProjectStatusDto,
    user?: any,
  ): Promise<ProjectDto> {
    const project = await this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    // Validate status
    if (!this.VALID_STATUSES.includes(updateProjectStatusDto.status)) {
      throw new BadRequestException(
        `Invalid status. Valid options: ${this.VALID_STATUSES.join(', ')}`,
      );
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      PLANNING: ['ACTIVE', 'ON_HOLD', 'CANCELLED'],
      ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
      ON_HOLD: ['ACTIVE', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const allowedNextStatuses = validTransitions[project.status] || [];
    if (!allowedNextStatuses.includes(updateProjectStatusDto.status)) {
      throw new BadRequestException(
        `Cannot transition from '${project.status}' to '${updateProjectStatusDto.status}'. Valid transitions: ${allowedNextStatuses.join(', ')}`,
      );
    }

    const updated = await this.projectsRepository.updateStatus(
      id,
      updateProjectStatusDto.status,
    );
    const stats = await this.projectsRepository.getProjectStats(id);

    return this.mapToProjectDto(updated, stats);
  }

  async deleteProject(id: string, user?: any): Promise<{ message: string }> {
    const project = await this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have permission to delete this project',
        );
      }
    }

    await this.projectsRepository.softDelete(id);
    return { message: 'Project deleted successfully' };
  }

  async restoreProject(id: string, user?: any): Promise<ProjectDto> {
    const project = await this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have permission to restore this project',
        );
      }
    }

    const restored = await this.projectsRepository.restore(id);
    const stats = await this.projectsRepository.getProjectStats(id);

    return this.mapToProjectDto(restored, stats);
  }

  // Milestone operations
  async createMilestone(
    projectId: string,
    createMilestoneDto: CreateMilestoneDto,
    user?: any,
  ): Promise<MilestoneDto> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    const milestone = await this.projectsRepository.createMilestone(
      projectId,
      createMilestoneDto,
    );
    return this.mapToMilestoneDto(milestone);
  }

  async listMilestones(projectId: string, user?: any): Promise<MilestoneDto[]> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    const milestones =
      await this.projectsRepository.findMilestonesByProject(projectId);
    return milestones.map((m) => this.mapToMilestoneDto(m));
  }

  async updateMilestone(
    id: string,
    updateMilestoneDto: UpdateMilestoneDto,
    user?: any,
  ): Promise<MilestoneDto> {
    const milestone = await this.projectsRepository.findMilestoneById(id);
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (user?.userType === 'CUSTOMER') {
      const project = await this.projectsRepository.findById(
        milestone.projectId,
      );
      if (
        !project ||
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have access to this milestone',
        );
      }
    }

    // Validate status if provided
    if (
      updateMilestoneDto.status &&
      !this.MILESTONE_STATUSES.includes(updateMilestoneDto.status)
    ) {
      throw new BadRequestException(
        `Invalid status. Valid options: ${this.MILESTONE_STATUSES.join(', ')}`,
      );
    }

    const updated = await this.projectsRepository.updateMilestone(
      id,
      updateMilestoneDto,
    );
    return this.mapToMilestoneDto(updated);
  }

  async completeMilestone(id: string, user?: any): Promise<MilestoneDto> {
    const milestone = await this.projectsRepository.findMilestoneById(id);
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (user?.userType === 'CUSTOMER') {
      const project = await this.projectsRepository.findById(
        milestone.projectId,
      );
      if (
        !project ||
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have access to this milestone',
        );
      }
    }

    const completed = await this.projectsRepository.completeMilestone(id);
    return this.mapToMilestoneDto(completed);
  }

  async deleteMilestone(id: string, user?: any): Promise<{ message: string }> {
    const milestone = await this.projectsRepository.findMilestoneById(id);
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (user?.userType === 'CUSTOMER') {
      const project = await this.projectsRepository.findById(
        milestone.projectId,
      );
      if (
        !project ||
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have permission to delete this milestone',
        );
      }
    }

    await this.projectsRepository.deleteMilestone(id);
    return { message: 'Milestone deleted successfully' };
  }

  // --- GitHub Repository Binding & Discovery ---

  async listAvailableGithubRepositories() {
    const isConfigured = this.githubService.isGithubAppConfigured();
    if (!isConfigured) {
      return {
        isConfigured: false,
        installations: [],
        appSlug: null,
        installUrl: null,
      };
    }

    // Strict Launchpad vs Projects Isolation:
    // Any installation belonging to a Launchpad student must NEVER be exposed to company Projects.
    const studentAccounts = await this.prisma.githubAccount.findMany({
      select: { installationId: true },
    });
    const studentInstallationIds = new Set(
      studentAccounts.map((a) => String(a.installationId)),
    );

    const [installations, connectionTest] = await Promise.all([
      this.githubService.getAppInstallations(),
      this.githubService
        .testScopedConnection('PROJECTS')
        .catch(() => ({ slug: null })),
    ]);

    const appSlug = (connectionTest as any)?.slug || 'neuravolt-launchpad';
    const installUrl = `https://github.com/apps/${appSlug}/installations/new`;
    const selectTargetUrl = `https://github.com/apps/${appSlug}/installations/select_target`;

    // Strict Isolation: Only include company installations (exclude all student installations)
    const companyInstallations = installations.filter(
      (inst: any) => !studentInstallationIds.has(String(inst.id)),
    );

    const result = await Promise.all(
      companyInstallations.map(async (inst: any) => {
        const repos = await this.githubService.getInstallationRepositories(
          String(inst.id),
        );
        return {
          id: String(inst.id),
          account: inst.account
            ? {
                login: inst.account.login,
                avatarUrl: inst.account.avatar_url,
                type: inst.account.type,
              }
            : null,
          repositories: repos.map((r: any) => ({
            id: String(r.id),
            name: r.name,
            fullName: r.full_name,
            private: !!r.private,
            defaultBranch: r.default_branch || 'main',
            description: r.description,
            htmlUrl: r.html_url,
          })),
        };
      }),
    );
    return {
      isConfigured: true,
      installations: result,
      appSlug,
      installUrl,
      selectTargetUrl,
    };
  }

  async bindGithubRepository(
    projectId: string,
    dto: BindProjectGithubDto,
    user?: any,
  ): Promise<ProjectDto> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Strict Launchpad vs Projects Isolation:
    // Reject any attempt to bind a student installation to a company project
    const isStudentAccount = await this.prisma.githubAccount.findFirst({
      where: { installationId: dto.installationId },
    });
    if (isStudentAccount) {
      throw new BadRequestException(
        'Security Isolation: Student installations cannot be connected to company projects.',
      );
    }

    const [owner, repo] = dto.repoFullName.split('/');
    if (!owner || !repo) {
      throw new BadRequestException(
        'Invalid repoFullName. Format must be owner/repo.',
      );
    }

    const ghRepo = await this.githubService.getRepositoryDetails(
      dto.installationId,
      owner,
      repo,
    );

    // Resolve project key
    let projectKey = dto.key ? dto.key.toUpperCase().trim() : project.key;
    if (!projectKey) {
      const words = project.name.trim().split(/\s+/).filter(Boolean);
      let candidate = '';
      if (words.length >= 2) {
        candidate = words
          .map((w: string) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 4);
      } else {
        candidate = project.name
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(0, 4);
      }
      if (candidate.length < 2)
        candidate = `PRJ${Math.floor(10 + Math.random() * 90)}`;

      const existing = await this.prisma.project.findFirst({
        where: { key: candidate, id: { not: projectId } },
      });
      projectKey = existing
        ? `PRJ${Math.floor(100 + Math.random() * 900)}`
        : candidate;
    }

    // Verify key uniqueness
    const keyConflict = await this.prisma.project.findFirst({
      where: { key: projectKey, id: { not: projectId } },
    });
    if (keyConflict) {
      throw new ConflictException(
        `Project key "${projectKey}" is already assigned to another project.`,
      );
    }

    // Condition 2: Initialize or synchronize task counter safely
    const existingTasks = await this.prisma.task.findMany({
      where: { projectId },
      select: { taskCode: true },
    });
    let maxExistingNumber = 0;
    for (const t of existingTasks) {
      if (t.taskCode) {
        const match = t.taskCode.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxExistingNumber) {
            maxExistingNumber = num;
          }
        }
      }
    }
    const initialBaseline = Math.max(maxExistingNumber, existingTasks.length);

    const existingCounter = await this.prisma.projectTaskCounter.findUnique({
      where: { projectId },
    });
    if (!existingCounter) {
      await this.prisma.projectTaskCounter.create({
        data: {
          projectId,
          lastNumber: initialBaseline,
        },
      });
    } else if (existingCounter.lastNumber < initialBaseline) {
      await this.prisma.projectTaskCounter.update({
        where: { projectId },
        data: { lastNumber: initialBaseline },
      });
    }

    // Update project with GitHub metadata
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        key: projectKey,
        githubRepo: dto.repoFullName,
        githubRepoId: String(ghRepo.id),
        githubInstallationId: dto.installationId,
        githubDefaultBranch: ghRepo.default_branch || 'main',
      },
    });

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'PROJECT_GITHUB_BIND',
        resourceType: 'Project',
        resourceId: projectId,
        severity: 'INFO',
        metadata: {
          repoFullName: dto.repoFullName,
          repoId: String(ghRepo.id),
          installationId: dto.installationId,
          defaultBranch: ghRepo.default_branch,
          key: projectKey,
        },
      },
    });

    const updated = await this.projectsRepository.findById(projectId);
    const stats = await this.projectsRepository.getProjectStats(projectId);
    return this.mapToProjectDto(updated, stats, user);
  }

  async unbindGithubRepository(
    projectId: string,
    user?: any,
  ): Promise<ProjectDto> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        githubRepo: null,
        githubRepoId: null,
        githubInstallationId: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'PROJECT_GITHUB_UNBIND',
        resourceType: 'Project',
        resourceId: projectId,
        severity: 'INFO',
        metadata: { previousRepo: project.githubRepo },
      },
    });

    const updated = await this.projectsRepository.findById(projectId);
    const stats = await this.projectsRepository.getProjectStats(projectId);
    return this.mapToProjectDto(updated, stats, user);
  }

  async checkPullRequestMergeability(
    projectId: string,
    prId: string,
  ): Promise<any> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.githubInstallationId) {
      throw new BadRequestException(
        'GitHub App is not connected to this project.',
      );
    }

    const pr = await this.prisma.taskPullRequest.findUnique({
      where: { id: prId },
      include: { task: true },
    });
    if (!pr) throw new NotFoundException(`Pull request ${prId} not found`);
    if (pr.task.projectId !== projectId) {
      throw new BadRequestException(
        'Pull request does not belong to this project.',
      );
    }

    const [owner, repo] = pr.repoFullName.split('/');
    if (!owner || !repo) {
      throw new BadRequestException(
        `Invalid repository name: ${pr.repoFullName}`,
      );
    }

    return this.githubService.checkPullRequestMergeability(
      project.githubInstallationId,
      owner,
      repo,
      pr.prNumber,
    );
  }

  async mergeProjectPullRequest(
    projectId: string,
    prId: string,
    user: any,
    options?: {
      commitTitle?: string;
      commitMessage?: string;
      mergeMethod?: 'squash' | 'merge' | 'rebase';
    },
  ): Promise<any> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.githubInstallationId) {
      throw new BadRequestException(
        'GitHub App is not connected to this project.',
      );
    }

    const pr = await this.prisma.taskPullRequest.findUnique({
      where: { id: prId },
      include: { task: true },
    });
    if (!pr) throw new NotFoundException(`Pull request ${prId} not found`);
    if (pr.task.projectId !== projectId) {
      throw new BadRequestException(
        'Pull request does not belong to this project.',
      );
    }

    const [owner, repo] = pr.repoFullName.split('/');
    if (!owner || !repo) {
      throw new BadRequestException(
        `Invalid repository name: ${pr.repoFullName}`,
      );
    }

    // 1. Perform merge via GithubService with fresh mergeability and verification
    const mergeResult = await this.githubService.mergePullRequest(
      project.githubInstallationId,
      owner,
      repo,
      pr.prNumber,
      options,
    );

    // 2. Update local TaskPullRequest record
    const updatedPR = await this.prisma.taskPullRequest.update({
      where: { id: prId },
      data: {
        isMerged: true,
        status: 'MERGED',
        mergedAt: mergeResult.mergedAt,
      },
    });

    // 3. PRESERVE QA WORKFLOW:
    // Merging a PR must NOT mark the task DONE!
    // Retain or transition task to 'REVIEW' for QA testing & manager verification.
    if (pr.task.status !== 'REVIEW' && pr.task.status !== 'DONE') {
      await this.tasksService.updateTaskStatus(pr.taskId, { status: 'review' });
    }

    // 4. Audit Log
    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'PROJECT_PR_MERGE',
        resourceType: 'Project',
        resourceId: projectId,
        severity: 'INFO',
        metadata: {
          prId,
          prNumber: pr.prNumber,
          repoFullName: pr.repoFullName,
          sha: mergeResult.sha,
          taskId: pr.taskId,
          mergedBy: user?.id,
        },
      },
    });

    // 5. Generate / synchronize draft release note automatically
    try {
      await this.generateDraftReleaseNote(projectId, user);
    } catch (e: any) {
      // Don't fail the merge if release draft generation has a minor issue
    }

    return {
      success: true,
      mergeResult,
      pullRequest: updatedPR,
    };
  }

  async getProjectReleaseNotes(projectId: string, user?: any): Promise<any[]> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    if (user?.userType === 'CUSTOMER') {
      if (
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    return this.prisma.projectReleaseNote.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        publishedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async generateDraftReleaseNote(projectId: string, user?: any): Promise<any> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    if (user?.userType === 'CUSTOMER') {
      if (
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    // Fetch tasks and merged PRs for this project
    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      include: {
        pullRequests: {
          where: { isMerged: true },
        },
      },
    });

    const mergedPRs = tasks.flatMap((t: any) =>
      t.pullRequests.map((pr: any) => ({
        ...pr,
        taskCode: t.taskCode,
        taskTitle: t.title,
      })),
    );

    const linkedTaskIds = Array.from(
      new Set(
        tasks
          .filter((t: any) => t.pullRequests.length > 0)
          .map((t: any) => t.id),
      ),
    );

    // Formulate sanitized, client-facing markdown summary
    // Strips commit hashes, emails, internal git trailers, and sensitive data from client-facing notes
    const sanitizeClientFacing = (str: string) => {
      if (!str) return '';
      return str
        .replace(/<[^>]*>/g, '') // remove HTML tags
        .replace(/[<>{}]/g, '') // remove remaining script/template delimiters
        .replace(/\b[0-9a-f]{7,40}\b/gi, '') // strip git commit SHAs (7 to 40 hex chars)
        .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '') // strip emails
        .replace(/\(?(?:commit|sha|hash):?\s*\)?/gi, '') // strip commit labels
        .replace(/\b(?:co-authored-by|signed-off-by):[^\n]+/gi, '') // strip git trailers
        .replace(/\s{2,}/g, ' ') // collapse multi-spaces
        .trim();
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const title = `Release Notes - ${project.key || project.name} (${dateStr})`;

    let markdown = `## ${project.name} Release (${dateStr})\n\n`;
    if (mergedPRs.length === 0) {
      markdown += `*No merged pull requests detected yet for this release cycle.*\n`;
    } else {
      markdown += `### Merged Features & Enhancements\n`;
      for (const pr of mergedPRs) {
        const cleanTitle = sanitizeClientFacing(pr.prTitle);
        const codePrefix = pr.taskCode ? `**[${pr.taskCode}]** ` : '';
        markdown += `- ${codePrefix}${cleanTitle} (PR #${pr.prNumber})\n`;
      }
    }

    // Check for existing unpublished draft
    const existingDraft = await this.prisma.projectReleaseNote.findFirst({
      where: { projectId, isPublished: false },
    });

    let draftNote: any;
    if (existingDraft) {
      draftNote = await this.prisma.projectReleaseNote.update({
        where: { id: existingDraft.id },
        data: {
          title,
          summary: markdown,
          linkedTaskIds,
        },
      });
    } else {
      draftNote = await this.prisma.projectReleaseNote.create({
        data: {
          projectId,
          title,
          summary: markdown,
          isPublished: false,
          linkedTaskIds,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'PROJECT_RELEASE_NOTE_DRAFT_CREATED',
        resourceType: 'Project',
        resourceId: projectId,
        severity: 'INFO',
        metadata: {
          noteId: draftNote.id,
          taskCount: linkedTaskIds.length,
          prCount: mergedPRs.length,
        },
      },
    });

    return draftNote;
  }

  async publishReleaseNote(
    projectId: string,
    noteId: string,
    user: any,
  ): Promise<any> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    if (user?.userType === 'CUSTOMER') {
      if (
        !project.organizationId ||
        project.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    const note = await this.prisma.projectReleaseNote.findFirst({
      where: { id: noteId, projectId },
    });
    if (!note) throw new NotFoundException(`Release note ${noteId} not found`);

    const published = await this.prisma.projectReleaseNote.update({
      where: { id: noteId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
        publishedById: user?.id || null,
      },
      include: {
        publishedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'PROJECT_RELEASE_NOTE_PUBLISHED',
        resourceType: 'Project',
        resourceId: projectId,
        severity: 'INFO',
        metadata: {
          noteId: published.id,
          title: published.title,
          publishedBy: user?.id,
        },
      },
    });

    return published;
  }

  // ═══════════════════════════════════════════════════════════════
  // GITHUB COLLABORATOR ACCESS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async listProjectCollaborators(
    projectId: string,
  ): Promise<{ collaborators: any[]; invitations: any[] }> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.githubRepo || !project.githubInstallationId) {
      throw new BadRequestException(
        `Project is not bound to a GitHub repository`,
      );
    }

    const [owner, repo] = project.githubRepo.split('/');
    if (!owner || !repo)
      throw new BadRequestException(
        `Invalid repository format "${project.githubRepo}"`,
      );

    const [rawCollaborators, rawInvitations] = await Promise.all([
      this.githubService.listCollaborators(
        project.githubInstallationId,
        owner,
        repo,
      ),
      this.githubService.listInvitations(
        project.githubInstallationId,
        owner,
        repo,
      ),
    ]);

    const collaborators = (rawCollaborators || []).map((c: any) => ({
      id: c.id,
      login: c.login || c.username,
      username: c.login || c.username,
      avatarUrl: c.avatar_url || c.avatarUrl,
      avatar_url: c.avatar_url || c.avatarUrl,
      role:
        c.role_name ||
        (c.permissions?.admin
          ? 'admin'
          : c.permissions?.push
            ? 'write'
            : 'read'),
      role_name:
        c.role_name ||
        (c.permissions?.admin
          ? 'admin'
          : c.permissions?.push
            ? 'write'
            : 'read'),
      permissions: c.permissions || {},
    }));

    const invitations = (rawInvitations || []).map((inv: any) => ({
      id: inv.id,
      invitee: inv.invitee?.login || inv.invitee || 'Invited User',
      permissions: inv.permissions || 'push',
      created_at: inv.created_at,
    }));

    return { collaborators, invitations };
  }

  async searchProjectCollaborators(
    projectId: string,
    query: string,
  ): Promise<any[]> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.githubInstallationId) {
      throw new BadRequestException(
        `Project is not bound to a GitHub repository`,
      );
    }

    return this.githubService.searchUsers(project.githubInstallationId, query);
  }

  async inviteProjectCollaborator(
    projectId: string,
    dto: {
      username: string;
      permission?: 'pull' | 'triage' | 'push' | 'maintain' | 'admin';
    },
    user: any,
  ): Promise<any> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.githubRepo || !project.githubInstallationId) {
      throw new BadRequestException(
        `Project is not bound to a GitHub repository`,
      );
    }

    const [owner, repo] = project.githubRepo.split('/');
    if (!owner || !repo)
      throw new BadRequestException(
        `Invalid repository format "${project.githubRepo}"`,
      );

    if (!dto?.username || !dto.username.trim()) {
      throw new BadRequestException('GitHub username is required');
    }
    const cleanUsername = dto.username.trim();

    const permission = dto.permission || 'push'; // Default to push (write access, never admin by default)
    if (!['pull', 'triage', 'push', 'maintain', 'admin'].includes(permission)) {
      throw new BadRequestException(
        `Invalid permission "${permission}". Must be pull, triage, push, maintain, or admin.`,
      );
    }

    const result = await this.githubService.inviteCollaborator(
      project.githubInstallationId,
      owner,
      repo,
      cleanUsername,
      permission,
    );

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'PROJECT_GITHUB_COLLABORATOR_INVITED',
        resourceType: 'Project',
        resourceId: projectId,
        severity: 'INFO',
        metadata: {
          username: cleanUsername,
          permission,
          repo: project.githubRepo,
          status: result.status,
          invitedBy: user?.id,
        },
      },
    });

    return {
      success: true,
      ...result,
      permission,
    };
  }

  async cancelProjectInvitation(
    projectId: string,
    invitationId: number,
    user: any,
  ): Promise<{ success: boolean }> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.githubRepo || !project.githubInstallationId) {
      throw new BadRequestException(
        `Project is not bound to a GitHub repository`,
      );
    }

    const [owner, repo] = project.githubRepo.split('/');
    if (!owner || !repo)
      throw new BadRequestException(
        `Invalid repository format "${project.githubRepo}"`,
      );

    await this.githubService.cancelInvitation(
      project.githubInstallationId,
      owner,
      repo,
      invitationId,
    );

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'PROJECT_GITHUB_INVITATION_CANCELLED',
        resourceType: 'Project',
        resourceId: projectId,
        severity: 'INFO',
        metadata: {
          invitationId,
          repo: project.githubRepo,
          cancelledBy: user?.id,
        },
      },
    });

    return { success: true };
  }

  async removeProjectCollaborator(
    projectId: string,
    username: string,
    user: any,
  ): Promise<{ success: boolean }> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.githubRepo || !project.githubInstallationId) {
      throw new BadRequestException(
        `Project is not bound to a GitHub repository`,
      );
    }

    const [owner, repo] = project.githubRepo.split('/');
    if (!owner || !repo)
      throw new BadRequestException(
        `Invalid repository format "${project.githubRepo}"`,
      );

    await this.githubService.removeCollaborator(
      project.githubInstallationId,
      owner,
      repo,
      username,
    );

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'PROJECT_GITHUB_COLLABORATOR_REMOVED',
        resourceType: 'Project',
        resourceId: projectId,
        severity: 'INFO',
        metadata: {
          username,
          repo: project.githubRepo,
          removedBy: user?.id,
        },
      },
    });

    return { success: true };
  }

  private mapToProjectDto(project: any, stats: any, user?: any): ProjectDto {
    const showFinancials = this.canViewFinancials(user);
    return {
      id: project.id,
      clientId: project.clientId,
      client: project.client
        ? { id: project.client.id, name: project.client.name }
        : undefined,
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      budget: showFinancials ? project.budget : undefined,
      key: project.key || undefined,
      githubRepo: project.githubRepo || undefined,
      githubRepoId: project.githubRepoId || undefined,
      githubInstallationId: project.githubInstallationId || undefined,
      githubDefaultBranch: project.githubDefaultBranch || 'main',
      milestones:
        project.milestones?.map((m: any) => this.mapToMilestoneDto(m)) || [],
      tasks:
        project.tasks?.map((t: any) => ({
          id: t.id,
          title: t.title,
          taskCode: t.taskCode || undefined,
          githubBranch: t.githubBranch || undefined,
          status: t.status,
          priority: t.priority || 'MEDIUM',
          assignee: t.assignments?.[0]?.user || undefined,
          pullRequests: t.pullRequests || [],
        })) || [],
      taskCount: stats.taskCount,
      timeLogged: stats.totalTimeLogged,
      tickets:
        project.tickets?.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority || 'MEDIUM',
          category: t.category,
          createdAt: t.createdAt,
        })) || [],
      attachments:
        project.attachments?.map((a: any) => ({
          id: a.id,
          filename: a.filename,
          originalName: a.originalName,
          mimeType: a.mimeType,
          size: a.size,
          url: a.url,
          isInternal: a.isInternal,
          createdAt: a.createdAt,
          uploadedBy: a.uploadedBy
            ? {
                id: a.uploadedBy.id,
                name:
                  `${a.uploadedBy.firstName || ''} ${a.uploadedBy.lastName || ''}`.trim() ||
                  a.uploadedBy.email,
                email: a.uploadedBy.email,
              }
            : null,
        })) || [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private mapToMilestoneDto(milestone: any): MilestoneDto {
    return {
      id: milestone.id,
      projectId: milestone.projectId,
      name: milestone.name,
      description: milestone.description,
      dueDate: milestone.dueDate,
      completedAt: milestone.completedAt,
      status: milestone.status,
      orderIndex: milestone.orderIndex,
      createdAt: milestone.createdAt,
      updatedAt: milestone.updatedAt,
    };
  }
}
