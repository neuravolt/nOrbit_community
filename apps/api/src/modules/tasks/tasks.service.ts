import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { TasksRepository } from './tasks.repository';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  ListTasksQuery,
  CreateCommentDto,
  CreateTimeLogDto,
  AssignTaskDto,
  TaskDto,
  ListTasksResponseDto,
  CommentDto,
  TimeLogDto,
} from './dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { slugify } from '@neuravolt/shared-utils';
import { WebPushService } from '../guardian/services/web-push.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private readonly VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'];
  private readonly VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  private readonly PRIORITY_ORDER: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly prisma: PrismaService,
    private readonly webPushService: WebPushService,
  ) {}

  async createTask(createTaskDto: CreateTaskDto, user?: any): Promise<TaskDto> {
    // Validate priority if provided
    if (
      createTaskDto.priority &&
      !this.VALID_PRIORITIES.includes(createTaskDto.priority)
    ) {
      throw new BadRequestException(
        `Invalid priority. Valid options: ${this.VALID_PRIORITIES.join(', ')}`,
      );
    }

    // Prevent duplicate tasks for the same ticket
    if (createTaskDto.ticketId) {
      const existing = await this.tasksRepository.findByTicketId(
        createTaskDto.ticketId,
      );
      if (existing) {
        throw new BadRequestException(
          'This support ticket has already been converted to a task.',
        );
      }

      // Inherit amcContractId from ticket if it exists
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: createTaskDto.ticketId },
        select: { amcContractId: true },
      });
      if (ticket && ticket.amcContractId) {
        createTaskDto.amcContractId = ticket.amcContractId;
      }
    }

    // Validate subtask depth (cannot create subtask of subtask)
    if (createTaskDto.parentId) {
      const parentTask = await this.tasksRepository.findById(
        createTaskDto.parentId,
      );
      if (!parentTask) {
        throw new NotFoundException('Parent task not found');
      }

      if (parentTask.parentId) {
        throw new BadRequestException(
          'Cannot create subtask of a subtask (max depth 1)',
        );
      }

      // Inherit project from parent
      createTaskDto.projectId = parentTask.projectId;
    }

    // Validate estimated hours is positive if provided
    if (createTaskDto.estimatedHours && createTaskDto.estimatedHours < 0) {
      throw new BadRequestException(
        'Estimated hours must be a positive number',
      );
    }

    const { assigneeId, ...restDto } = createTaskDto;

    // Single-transaction atomic counter allocation and task creation
    const createdTask = await this.prisma.$transaction(async (tx) => {
      let taskCode: string | null = null;
      let githubBranch: string | null = null;

      if (restDto.projectId) {
        const project = await tx.project.findUnique({
          where: { id: restDto.projectId },
          select: { key: true },
        });

        if (project?.key) {
          // Condition 2: Safe backfill & gap protection - inspect existing task codes and total tasks
          const existingTasks = await tx.task.findMany({
            where: { projectId: restDto.projectId },
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

          const initialBaseline = Math.max(
            maxExistingNumber,
            existingTasks.length,
          );

          let counter = await tx.projectTaskCounter.upsert({
            where: { projectId: restDto.projectId },
            create: {
              projectId: restDto.projectId,
              lastNumber: initialBaseline + 1,
            },
            update: {
              lastNumber: { increment: 1 },
            },
          });

          if (counter.lastNumber <= maxExistingNumber) {
            counter = await tx.projectTaskCounter.update({
              where: { projectId: restDto.projectId },
              data: { lastNumber: maxExistingNumber + 1 },
            });
          }

          taskCode = `${project.key}-${counter.lastNumber}`;
          const branchSlug = slugify(restDto.title || 'task');
          githubBranch = `task/${taskCode.toLowerCase()}-${branchSlug}`;
        }
      }

      const { priority, estimatedHours, parentId, dueDate, ...taskFields } =
        restDto as any;
      const formattedDueDate = dueDate ? new Date(dueDate) : null;

      const orgId =
        user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
      const task = await tx.task.create({
        data: {
          ...taskFields,
          taskCode,
          githubBranch,
          organizationId: orgId,
          status: 'TODO',
          priority: priority || 'MEDIUM',
          dueDate: formattedDueDate,
          estimatedHours: estimatedHours ? Number(estimatedHours) : null,
          parentId: parentId || null,
        },
      });

      if (assigneeId) {
        await tx.taskAssignment.create({
          data: {
            taskId: task.id,
            userId: assigneeId,
          },
        });
      }

      return task;
    });

    const updatedTask = await this.tasksRepository.findById(createdTask.id);
    const stats = await this.tasksRepository.getTaskStats(createdTask.id);

    if (assigneeId) {
      this.sendTaskPushNotification(
        createdTask.id,
        [assigneeId],
        restDto.title || 'Task',
        createTaskDto.priority || 'MEDIUM',
      ).catch(() => undefined);
    }

    return this.mapToTaskDto(updatedTask, stats);
  }

  async listTasks(
    query: ListTasksQuery,
    user?: any,
  ): Promise<ListTasksResponseDto> {
    // Validate status if provided
    if (query.status) {
      const statusVal = query.status.toLowerCase().replace('-', '_');
      if (!this.VALID_STATUSES.includes(statusVal)) {
        throw new BadRequestException(
          `Invalid status. Valid options: ${this.VALID_STATUSES.join(', ')}`,
        );
      }
      query.status = statusVal;
    }

    // Validate priority if provided
    if (query.priority && !this.VALID_PRIORITIES.includes(query.priority)) {
      throw new BadRequestException(
        `Invalid priority. Valid options: ${this.VALID_PRIORITIES.join(', ')}`,
      );
    }

    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const result = await this.tasksRepository.findAll(query, orgId);

    const tasksWithStats = await Promise.all(
      result.tasks.map(async (t: any) => {
        const stats = await this.tasksRepository.getTaskStats(t.id);
        return {
          id: t.id,
          projectId: t.projectId,
          project: t.project
            ? { id: t.project.id, name: t.project.name }
            : undefined,
          title: t.title,
          status: t.status,
          priority: t.priority || 'MEDIUM',
          dueDate: t.dueDate,
          estimatedHours: t.estimatedHours || 0,
          assignments:
            t.assignments?.map((a: any) => this.mapToAssignmentDto(a)) || [],
          assigneeCount: stats.assignmentCount,
          commentCount: stats.commentCount,
          subtaskCount: stats.subtaskCount,
          totalTimeLogged: stats.totalTimeLogged,
          createdAt: t.createdAt,
          ticketId: t.ticketId,
          taskCode: t.taskCode,
          githubBranch: t.githubBranch,
          pullRequests: t.pullRequests,
        };
      }),
    );

    return {
      tasks: tasksWithStats,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getTaskById(id: string, user?: any): Promise<TaskDto> {
    const task = await this.tasksRepository.findById(id);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !task.organizationId ||
        task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    const stats = await this.tasksRepository.getTaskStats(id);
    return this.mapToTaskDto(task, stats);
  }

  async updateTask(
    id: string,
    updateTaskDto: UpdateTaskDto,
    user?: any,
  ): Promise<TaskDto> {
    const task = await this.tasksRepository.findById(id);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !task.organizationId ||
        task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    // Validate priority if provided
    if (
      updateTaskDto.priority &&
      !this.VALID_PRIORITIES.includes(updateTaskDto.priority)
    ) {
      throw new BadRequestException(
        `Invalid priority. Valid options: ${this.VALID_PRIORITIES.join(', ')}`,
      );
    }

    // Validate estimated hours is positive if provided
    if (updateTaskDto.estimatedHours && updateTaskDto.estimatedHours < 0) {
      throw new BadRequestException(
        'Estimated hours must be a positive number',
      );
    }

    const { assigneeId, ...restDto } = updateTaskDto;
    const updated = await this.tasksRepository.update(id, restDto);

    if (assigneeId !== undefined) {
      await this.tasksRepository.clearAssignments(id);
      if (assigneeId) {
        await this.tasksRepository.createAssignments(id, [assigneeId]);
        this.sendTaskPushNotification(
          id,
          [assigneeId],
          restDto.title || task.title,
          restDto.priority || task.priority || 'MEDIUM',
        ).catch(() => undefined);
      }
    }

    const updatedTask = await this.tasksRepository.findById(id);
    const stats = await this.tasksRepository.getTaskStats(id);

    return this.mapToTaskDto(updatedTask, stats);
  }

  async updateTaskStatus(
    id: string,
    updateTaskStatusDto: UpdateTaskStatusDto,
    user?: any,
  ): Promise<TaskDto> {
    const task = await this.tasksRepository.findById(id);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !task.organizationId ||
        task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    // Validate and normalize status
    const statusVal = updateTaskStatusDto.status
      .toLowerCase()
      .replace('-', '_');
    if (!this.VALID_STATUSES.includes(statusVal)) {
      throw new BadRequestException(
        `Invalid status. Valid options: ${this.VALID_STATUSES.join(', ')}`,
      );
    }

    const updated = await this.tasksRepository.updateStatus(id, statusVal);

    // Sync status back to Support Ticket if ticketId is linked
    if (task.ticketId) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: task.ticketId },
      });
      if (ticket) {
        let newTicketStatus = ticket.status;
        let resolvedAt = ticket.resolvedAt;
        let closedAt = ticket.closedAt;

        if (statusVal === 'done') {
          newTicketStatus = 'RESOLVED';
          resolvedAt = new Date();
        } else if (statusVal === 'in_progress' || statusVal === 'review') {
          newTicketStatus = 'IN_PROGRESS';
        } else if (statusVal === 'todo') {
          if (
            ticket.status === 'RESOLVED' ||
            ticket.status === 'CLOSED' ||
            ticket.status === 'PENDING_RESOLUTION'
          ) {
            newTicketStatus = 'REOPENED';
            resolvedAt = null;
            closedAt = null;
          } else {
            newTicketStatus = 'OPEN';
          }
        }

        await this.prisma.ticket.update({
          where: { id: task.ticketId },
          data: {
            status: newTicketStatus as any,
            resolvedAt,
            closedAt,
          },
        });
      }
    }

    const stats = await this.tasksRepository.getTaskStats(id);

    return this.mapToTaskDto(updated, stats);
  }

  async deleteTask(id: string, user?: any): Promise<{ message: string }> {
    const task = await this.tasksRepository.findById(id);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !task.organizationId ||
        task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have permission to delete this task',
        );
      }
    }

    await this.tasksRepository.softDelete(id);
    return { message: 'Task deleted successfully' };
  }

  async restoreTask(id: string, user?: any): Promise<TaskDto> {
    const task = await this.tasksRepository.findById(id);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !task.organizationId ||
        task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have permission to restore this task',
        );
      }
    }

    const restored = await this.tasksRepository.restore(id);
    const stats = await this.tasksRepository.getTaskStats(restored.id);

    return this.mapToTaskDto(restored, stats);
  }

  // Assignments
  async assignUsers(taskId: string, assignTaskDto: AssignTaskDto, user?: any) {
    const task = await this.tasksRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !task.organizationId ||
        task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    if (!assignTaskDto.userIds || assignTaskDto.userIds.length === 0) {
      throw new BadRequestException('At least one user must be assigned');
    }

    await this.tasksRepository.createAssignments(taskId, assignTaskDto.userIds);
    const assignments =
      await this.tasksRepository.findAssignmentsByTask(taskId);

    this.sendTaskPushNotification(
      taskId,
      assignTaskDto.userIds,
      task.title,
      task.priority || 'MEDIUM',
    ).catch(() => undefined);

    return assignments;
  }

  async unassignUser(taskId: string, userId: string, user?: any) {
    const task = await this.tasksRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !task.organizationId ||
        task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    await this.tasksRepository.removeAssignment(taskId, userId);
    return { message: 'User unassigned successfully' };
  }

  // Comments
  async addComment(
    taskId: string,
    userId: string,
    createCommentDto: CreateCommentDto,
    user?: any,
  ): Promise<CommentDto> {
    const task = await this.tasksRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !task.organizationId ||
        task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    if (
      !createCommentDto.content ||
      createCommentDto.content.trim().length === 0
    ) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    const comment = await this.tasksRepository.createComment(
      taskId,
      userId,
      createCommentDto,
    );
    return this.mapToCommentDto(comment);
  }

  async getComments(taskId: string, user?: any) {
    const task = await this.tasksRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !task.organizationId ||
        task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    const comments = await this.tasksRepository.findCommentsByTask(taskId);
    return comments.map((c) => this.mapToCommentDto(c));
  }

  // Time Logs
  async logTime(
    taskId: string,
    userId: string,
    projectId: string,
    createTimeLogDto: CreateTimeLogDto,
    user?: any,
  ): Promise<TimeLogDto> {
    const task = await this.tasksRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !task.organizationId ||
        task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    if (createTimeLogDto.hours <= 0) {
      throw new BadRequestException('Hours must be greater than 0');
    }

    const timeLog = await this.tasksRepository.createTimeLog(
      taskId,
      projectId,
      userId,
      createTimeLogDto,
      task.amcContractId || undefined,
    );

    // Sync AMC usedHours when task is linked to an AMC contract
    if (task.amcContractId) {
      await this.prisma.amcContract.update({
        where: { id: task.amcContractId },
        data: { usedHours: { increment: createTimeLogDto.hours } },
      });
    }

    return this.mapToTimeLogDto(timeLog);
  }

  async getTimeLogs(taskId: string, user?: any) {
    const task = await this.tasksRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !task.organizationId ||
        task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    const timeLogs = await this.tasksRepository.findTimeLogsByTask(taskId);
    return timeLogs.map((t) => this.mapToTimeLogDto(t));
  }

  async deleteTimeLog(id: string, user?: any) {
    if (user?.userType === 'CUSTOMER') {
      const timeLog = await (this.prisma.timeLog as any).findUnique({
        where: { id },
        include: { task: true },
      });
      if (
        !timeLog ||
        !timeLog.task ||
        !timeLog.task.organizationId ||
        timeLog.task.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have permission to delete this time log',
        );
      }
    }

    // Fetch before deleting so we can decrement AMC usedHours
    const timeLog = await (this.prisma.timeLog as any).findUnique({
      where: { id },
      select: { amcContractId: true, hours: true },
    });

    await this.tasksRepository.deleteTimeLog(id);

    // Decrement AMC usedHours to keep contract consumption accurate
    if (timeLog?.amcContractId) {
      await this.prisma.amcContract.update({
        where: { id: timeLog.amcContractId },
        data: { usedHours: { decrement: Number(timeLog.hours) } },
      });
    }

    return { message: 'Time log deleted successfully' };
  }

  private mapToTaskDto(task: any, stats: any): TaskDto {
    return {
      id: task.id,
      projectId: task.projectId,
      milestoneId: task.milestoneId,
      parentId: task.parentId || undefined,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority || 'MEDIUM',
      dueDate: task.dueDate,
      estimatedHours: task.estimatedHours || 0,
      assignments:
        task.assignments?.map((a: any) => this.mapToAssignmentDto(a)) || [],
      comments: task.comments?.map((c: any) => this.mapToCommentDto(c)) || [],
      timeLogs: task.timeLogs?.map((t: any) => this.mapToTimeLogDto(t)) || [],
      subtasks:
        task.subtasks?.map((s: any) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          priority: s.priority || 'MEDIUM',
          dueDate: s.dueDate,
          estimatedHours: s.estimatedHours || 0,
        })) || [],
      totalTimeLogged: stats.totalTimeLogged,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      ticketId: task.ticketId,
      taskCode: task.taskCode || undefined,
      githubBranch: task.githubBranch || undefined,
      pullRequests: task.pullRequests || [],
      project: task.project || undefined,
      attachments: task.attachments || [],
    };
  }

  private mapToAssignmentDto(assignment: any) {
    return {
      id: assignment.id,
      taskId: assignment.taskId,
      userId: assignment.userId,
      assignedAt: assignment.createdAt || assignment.assignedAt,
      user: assignment.user
        ? {
            id: assignment.user.id,
            email: assignment.user.email,
            firstName: assignment.user.firstName,
            lastName: assignment.user.lastName,
          }
        : undefined,
    };
  }

  private mapToCommentDto(comment: any): CommentDto {
    return {
      id: comment.id,
      taskId: comment.taskId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt,
      user: comment.user
        ? {
            id: comment.user.id,
            email: comment.user.email,
            firstName: comment.user.firstName,
            lastName: comment.user.lastName,
          }
        : undefined,
    };
  }

  private mapToTimeLogDto(timeLog: any): TimeLogDto {
    return {
      id: timeLog.id,
      taskId: timeLog.taskId,
      userId: timeLog.userId,
      projectId: timeLog.projectId || timeLog.task?.projectId || '',
      description: timeLog.description,
      hours: timeLog.hours,
      logDate: timeLog.date,
      createdAt: timeLog.createdAt,
      user: timeLog.user
        ? {
            id: timeLog.user.id,
            email: timeLog.user.email,
            firstName: timeLog.user.firstName,
            lastName: timeLog.user.lastName,
          }
        : undefined,
    };
  }

  private async sendTaskPushNotification(
    taskId: string,
    userIds: string[],
    taskTitle: string,
    priority: string,
  ) {
    try {
      if (!this.webPushService.enabled || !userIds || !userIds.length) return;

      const isCritical = priority?.toUpperCase() === 'CRITICAL';
      const payload = {
        title: isCritical ? '🚨 URGENT TASK ASSIGNED' : '📋 New Task Assigned',
        body: taskTitle,
        url: `/tasks/${taskId}`,
        priority: priority || 'NORMAL',
        spokenText: isCritical
          ? `Alert! Urgent task assigned: ${taskTitle}`
          : undefined,
        tag: `task-${taskId}`,
      };

      for (const userId of userIds) {
        const sent = await this.webPushService
          .sendToUser(userId, payload)
          .catch((err: any) => {
            this.logger.warn(
              `Could not send push to user ${userId}: ${err?.message}`,
            );
            return 0;
          });
        this.logger.log(
          `Task push notification for task ${taskId} sent to user ${userId} (${sent} device(s) delivered)`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Task push notification dispatch failed: ${err?.message}`,
      );
    }
  }
}
