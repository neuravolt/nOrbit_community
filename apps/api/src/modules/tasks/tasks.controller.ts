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
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  ListTasksQuery,
  AssignTaskDto,
  CreateCommentDto,
  CreateTimeLogDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import {
  PermissionsGuard,
  Permissions,
} from '../roles/guards/permissions.guard';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['tasks:create'])
  async createTask(@Body() createTaskDto: CreateTaskDto, @Req() req: any) {
    return this.tasksService.createTask(createTaskDto, req?.user);
  }

  @Get()
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['tasks:read'])
  async listTasks(@Query() query: ListTasksQuery, @Req() req: any) {
    return this.tasksService.listTasks(query, req?.user);
  }

  @Get(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['tasks:read'])
  async getTaskById(@Param('id') id: string, @Req() req: any) {
    return this.tasksService.getTaskById(id, req?.user);
  }

  @Patch(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['tasks:update'])
  async updateTask(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Req() req: any,
  ) {
    return this.tasksService.updateTask(id, updateTaskDto, req?.user);
  }

  @Patch(':id/status')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  @Permissions(['tasks:update'])
  async updateTaskStatus(
    @Param('id') id: string,
    @Body() updateTaskStatusDto: UpdateTaskStatusDto,
    @Req() req: any,
  ) {
    return this.tasksService.updateTaskStatus(
      id,
      updateTaskStatusDto,
      req?.user,
    );
  }

  @Delete(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['tasks:delete'])
  async deleteTask(@Param('id') id: string, @Req() req: any) {
    return this.tasksService.deleteTask(id, req?.user);
  }

  @Patch(':id/restore')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['tasks:restore'])
  async restoreTask(@Param('id') id: string, @Req() req: any) {
    return this.tasksService.restoreTask(id, req?.user);
  }

  // Assignments
  @Post(':id/assignments')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['tasks:update'])
  async assignUsers(
    @Param('id') id: string,
    @Body() assignTaskDto: AssignTaskDto,
    @Req() req: any,
  ) {
    return this.tasksService.assignUsers(id, assignTaskDto, req?.user);
  }

  @Delete(':id/assignments/:userId')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['tasks:update'])
  async unassignUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.tasksService.unassignUser(id, userId, req?.user);
  }

  // Comments
  @Post(':id/comments')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['tasks:comment'])
  async addComment(
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: any,
  ) {
    return this.tasksService.addComment(
      id,
      req?.user?.id,
      createCommentDto,
      req?.user,
    );
  }

  @Get(':id/comments')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['tasks:read'])
  async getComments(@Param('id') id: string, @Req() req: any) {
    return this.tasksService.getComments(id, req?.user);
  }

  // Time Logs
  @Post(':id/time-logs')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['tasks:update'])
  async logTime(
    @Param('id') id: string,
    @Body() createTimeLogDto: CreateTimeLogDto,
    @Req() req: any,
  ) {
    const task = await this.tasksService.getTaskById(id, req?.user);
    return this.tasksService.logTime(
      id,
      req?.user?.id,
      task?.projectId,
      createTimeLogDto,
      req?.user,
    );
  }

  @Get(':id/time-logs')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA', 'EMPLOYEE'])
  @Permissions(['tasks:read'])
  async getTimeLogs(@Param('id') id: string, @Req() req: any) {
    return this.tasksService.getTimeLogs(id, req?.user);
  }

  @Delete('time-logs/:id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER'])
  @Permissions(['tasks:delete'])
  async deleteTimeLog(@Param('id') id: string, @Req() req: any) {
    return this.tasksService.deleteTimeLog(id, req?.user);
  }
}
