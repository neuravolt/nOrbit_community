import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
  ListProjectsQuery,
  CreateMilestoneDto,
  UpdateMilestoneDto,
  BindProjectGithubDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import {
  PermissionsGuard,
  Permissions,
} from '../roles/guards/permissions.guard';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('github/repositories')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:update'])
  async listAvailableGithubRepositories() {
    return this.projectsService.listAvailableGithubRepositories();
  }

  @Post()
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['projects:create'])
  async createProject(
    @Body() createProjectDto: CreateProjectDto,
    @Req() req: any,
  ) {
    return this.projectsService.createProject(createProjectDto, req?.user);
  }

  @Get()
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['projects:read'])
  async listProjects(@Req() req: any, @Query() query: ListProjectsQuery) {
    return this.projectsService.listProjects(query, req?.user);
  }

  @Get(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['projects:read'])
  async getProjectById(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getProjectById(id, req?.user);
  }

  @Patch(':id/github')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:update'])
  async bindGithubRepository(
    @Param('id') id: string,
    @Body() bindDto: BindProjectGithubDto,
    @Req() req: any,
  ) {
    return this.projectsService.bindGithubRepository(id, bindDto, req?.user);
  }

  @Delete(':id/github')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:update'])
  async unbindGithubRepository(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.unbindGithubRepository(id, req?.user);
  }

  @Get(':id/pull-requests/:prId/mergeability')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  @Permissions(['projects:read'])
  async checkPullRequestMergeability(
    @Param('id') id: string,
    @Param('prId') prId: string,
  ) {
    return this.projectsService.checkPullRequestMergeability(id, prId);
  }

  @Post(':id/pull-requests/:prId/merge')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:update'])
  async mergeProjectPullRequest(
    @Param('id') id: string,
    @Param('prId') prId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.projectsService.mergeProjectPullRequest(
      id,
      prId,
      req?.user,
      body,
    );
  }

  @Get(':id/release-notes')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['projects:read'])
  async getProjectReleaseNotes(@Param('id') id: string, @Req() req?: any) {
    if (req?.user) {
      return this.projectsService.getProjectReleaseNotes(id, req.user);
    }
    return this.projectsService.getProjectReleaseNotes(id);
  }

  @Post(':id/release-notes/draft')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:update'])
  async generateDraftReleaseNote(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.generateDraftReleaseNote(id, req?.user);
  }

  @Post(':id/release-notes/:noteId/publish')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:update'])
  async publishReleaseNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Req() req: any,
  ) {
    return this.projectsService.publishReleaseNote(id, noteId, req?.user);
  }

  // Collaborator Access Management
  @Get(':id/collaborators')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  @Permissions(['projects:read'])
  async listProjectCollaborators(@Param('id') id: string) {
    return this.projectsService.listProjectCollaborators(id);
  }

  @Get(':id/collaborators/search')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:update'])
  async searchProjectCollaborators(
    @Param('id') id: string,
    @Query('q') q: string,
  ) {
    return this.projectsService.searchProjectCollaborators(id, q);
  }

  @Post(':id/collaborators/invite')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:update'])
  async inviteProjectCollaborator(
    @Param('id') id: string,
    @Body()
    dto: {
      username: string;
      permission?: 'pull' | 'triage' | 'push' | 'maintain' | 'admin';
    },
    @Req() req: any,
  ) {
    return this.projectsService.inviteProjectCollaborator(id, dto, req?.user);
  }

  @Delete(':id/collaborators/invitations/:invitationId')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:update'])
  async cancelProjectInvitation(
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
    @Req() req: any,
  ) {
    return this.projectsService.cancelProjectInvitation(
      id,
      parseInt(invitationId, 10),
      req?.user,
    );
  }

  @Delete(':id/collaborators/:username')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:update'])
  async removeProjectCollaborator(
    @Param('id') id: string,
    @Param('username') username: string,
    @Req() req: any,
  ) {
    return this.projectsService.removeProjectCollaborator(
      id,
      username,
      req?.user,
    );
  }

  @Patch(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['projects:update'])
  async updateProject(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(id, updateProjectDto, req?.user);
  }

  @Patch(':id/status')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:update'])
  async updateProjectStatus(
    @Param('id') id: string,
    @Body() updateProjectStatusDto: UpdateProjectStatusDto,
    @Req() req: any,
  ) {
    return this.projectsService.updateProjectStatus(
      id,
      updateProjectStatusDto,
      req?.user,
    );
  }

  @Delete(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:delete'])
  async deleteProject(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.deleteProject(id, req?.user);
  }

  @Patch(':id/restore')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:restore'])
  async restoreProject(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.restoreProject(id, req?.user);
  }

  // Milestone endpoints
  @Post(':projectId/milestones')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['projects:update'])
  async createMilestone(
    @Param('projectId') projectId: string,
    @Body() createMilestoneDto: CreateMilestoneDto,
    @Req() req: any,
  ) {
    return this.projectsService.createMilestone(
      projectId,
      createMilestoneDto,
      req?.user,
    );
  }

  @Get(':projectId/milestones')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['projects:read'])
  async listMilestones(@Param('projectId') projectId: string, @Req() req: any) {
    return this.projectsService.listMilestones(projectId, req?.user);
  }

  @Patch('milestones/:id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['projects:update'])
  async updateMilestone(
    @Param('id') id: string,
    @Body() updateMilestoneDto: UpdateMilestoneDto,
    @Req() req: any,
  ) {
    return this.projectsService.updateMilestone(
      id,
      updateMilestoneDto,
      req?.user,
    );
  }

  @Patch('milestones/:id/complete')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['projects:update'])
  async completeMilestone(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.completeMilestone(id, req?.user);
  }

  @Delete('milestones/:id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['projects:delete'])
  async deleteMilestone(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.deleteMilestone(id, req?.user);
  }
}
