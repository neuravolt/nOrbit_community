import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  ListTasksQuery,
  CreateCommentDto,
  CreateTimeLogDto,
  AssignTaskDto,
} from './dto';

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const task = await (this.prisma.task as any).findUnique({
      where: { id },
      include: {
        assignments: { include: { user: true } },
        comments: { include: { user: true } },
        timeLogs: { include: { user: true } },
        project: {
          select: { id: true, name: true, key: true, githubRepo: true },
        },
        subtasks: { where: { deletedAt: null } },
        pullRequests: { orderBy: { prNumber: 'desc' } },
      },
    });

    if (!task) return null;

    const OR: any[] = [{ taskId: task.id }];
    if (task.ticketId) {
      OR.push({ ticketId: task.ticketId });
    }

    const attachments = await (this.prisma.attachment as any).findMany({
      where: { OR },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        uploadedByClientUser: { select: { id: true, name: true } },
      },
    });

    return {
      ...task,
      attachments,
    };
  }

  async findByTicketId(ticketId: string) {
    const task = await (this.prisma.task as any).findFirst({
      where: { ticketId, deletedAt: null },
      include: {
        assignments: { include: { user: true } },
        comments: { include: { user: true } },
        timeLogs: { include: { user: true } },
        project: { select: { id: true, name: true } },
        subtasks: { where: { deletedAt: null } },
      },
    });

    if (!task) return null;

    const attachments = await (this.prisma.attachment as any).findMany({
      where: {
        OR: [{ taskId: task.id }, { ticketId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        uploadedByClientUser: { select: { id: true, name: true } },
      },
    });

    return {
      ...task,
      attachments,
    };
  }

  async findAll(query: ListTasksQuery, organizationId?: string | null) {
    const {
      page = 1,
      limit = 20,
      projectId,
      status,
      priority,
      assigneeId,
      dueDateFrom,
      dueDateTo,
      search,
      sort = 'createdAt',
      sortOrder = 'desc',
      ticketId,
    } = query;
    const _page = Number(page);
    const _limit = Number(limit);
    const skip = (_page - 1) * _limit;

    const where: any = { deletedAt: null }; // Only root tasks

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (status) {
      where.status = status.toUpperCase().replace('-', '_');
    }

    if (ticketId) {
      where.ticketId = ticketId;
    }

    if (assigneeId) {
      where.assignments = {
        some: { userId: assigneeId },
      };
    }

    if (dueDateFrom || dueDateTo) {
      where.dueDate = {};
      if (dueDateFrom) where.dueDate.gte = dueDateFrom;
      if (dueDateTo) where.dueDate.lte = dueDateTo;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sortBy = sort === 'priority' ? 'createdAt' : sort;

    const [tasks, total] = await Promise.all([
      (this.prisma.task as any).findMany({
        where,
        skip,
        take: _limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          project: true,
          assignments: {
            include: {
              user: true,
            },
          },
          _count: {
            select: {
              assignments: true,
              comments: true,
            },
          },
          timeLogs: {
            select: { hours: true },
          },
        },
      }),
      (this.prisma.task as any).count({ where }),
    ]);

    return {
      tasks,
      total,
      page: _page,
      limit: _limit,
      totalPages: Math.ceil(total / _limit),
    };
  }

  async create(createTaskDto: CreateTaskDto, organizationId?: string | null) {
    const { priority, estimatedHours, parentId, ...data } =
      createTaskDto as any;
    if (data.dueDate !== undefined) data.dueDate = toDateOrNull(data.dueDate);
    return (this.prisma.task as any).create({
      data: {
        ...data,
        organizationId: organizationId || undefined,
        status: 'TODO',
        priority: priority || 'MEDIUM',
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
        parentId: parentId || null,
      },
      include: {
        assignments: { include: { user: true } },
        comments: { include: { user: true } },
        attachments: true,
        timeLogs: { include: { user: true } },
      },
    });
  }

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    const { priority, estimatedHours, parentId, ...data } =
      updateTaskDto as any;
    const updateData: any = { ...data };
    if (updateData.dueDate !== undefined)
      updateData.dueDate = toDateOrNull(updateData.dueDate);
    if (priority !== undefined) {
      updateData.priority = priority;
    }
    if (estimatedHours !== undefined) {
      updateData.estimatedHours = estimatedHours
        ? Number(estimatedHours)
        : null;
    }
    if (parentId !== undefined) {
      updateData.parentId = parentId || null;
    }
    return (this.prisma.task as any).update({
      where: { id },
      data: updateData,
      include: {
        assignments: { include: { user: true } },
        comments: { include: { user: true } },
        attachments: true,
        timeLogs: { include: { user: true } },
      },
    });
  }

  async updateStatus(id: string, status: string) {
    const dbStatus = status.toUpperCase().replace('-', '_');
    return (this.prisma.task as any).update({
      where: { id },
      data: { status: dbStatus },
      include: {
        assignments: { include: { user: true } },
        comments: { include: { user: true } },
        attachments: true,
        timeLogs: { include: { user: true } },
      },
    });
  }

  async softDelete(id: string) {
    return (this.prisma.task as any).update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    return (this.prisma.task as any).update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  // Task Assignments
  async createAssignments(taskId: string, userIds: string[]) {
    return (this.prisma.taskAssignment as any).createMany({
      data: userIds.map((userId) => ({
        taskId,
        userId,
      })),
    });
  }

  async removeAssignment(taskId: string, userId: string) {
    return (this.prisma.taskAssignment as any).deleteMany({
      where: { taskId, userId },
    });
  }

  async clearAssignments(taskId: string) {
    return (this.prisma.taskAssignment as any).deleteMany({
      where: { taskId },
    });
  }

  async findAssignmentsByTask(taskId: string) {
    return (this.prisma.taskAssignment as any).findMany({
      where: { taskId },
      include: { user: true },
    });
  }

  // Comments
  async createComment(
    taskId: string,
    userId: string,
    createCommentDto: CreateCommentDto,
  ) {
    return (this.prisma.comment as any).create({
      data: {
        taskId,
        userId,
        ...createCommentDto,
      },
      include: { user: true },
    });
  }

  async findCommentsByTask(taskId: string) {
    return (this.prisma.comment as any).findMany({
      where: { taskId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Time Logs
  async createTimeLog(
    taskId: string,
    projectId: string,
    userId: string,
    createTimeLogDto: CreateTimeLogDto,
    amcContractId?: string,
  ) {
    return (this.prisma.timeLog as any).create({
      data: {
        taskId,
        userId,
        hours: createTimeLogDto.hours,
        description: createTimeLogDto.description,
        date: new Date(createTimeLogDto.logDate || new Date()),
        amcContractId: amcContractId || null,
      },
      include: { user: true },
    });
  }

  async findTimeLogsByTask(taskId: string) {
    return (this.prisma.timeLog as any).findMany({
      where: { taskId },
      include: { user: true },
      orderBy: { date: 'desc' }, // changed logDate to date
    });
  }

  async deleteTimeLog(id: string) {
    return (this.prisma.timeLog as any).delete({
      where: { id },
    });
  }

  async getTotalTimeLoggedForTask(taskId: string) {
    const result = await (this.prisma.timeLog as any).aggregate({
      where: { taskId },
      _sum: { hours: true },
    });
    return result._sum?.hours || 0;
  }

  async findSubtasks(parentId: string) {
    return [];
  }

  async countSubtasks(parentId: string) {
    return 0;
  }

  async getTaskStats(taskId: string) {
    const [assignmentCount, commentCount, totalTimeLogged] = await Promise.all([
      (this.prisma.taskAssignment as any).count({
        where: { taskId },
      }),
      (this.prisma.comment as any).count({
        where: { taskId },
      }),
      this.getTotalTimeLoggedForTask(taskId),
    ]);

    return {
      assignmentCount,
      commentCount,
      subtaskCount: 0,
      totalTimeLogged,
    };
  }
}

/**
 * A due date from a form ("2026-10-05"), an ISO string or a Date, as a Date; empty means "no due date".
 * Prisma rejects a bare "YYYY-MM-DD" for a DateTime column, which made creating a task with a due
 * date fail with a 500.
 */
export function toDateOrNull(v: unknown): Date | null {
  if (v === null || v === '' || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime()))
    throw new BadRequestException('dueDate is not a valid date');
  return d;
}
