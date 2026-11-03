import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ListProjectsQuery,
  CreateMilestoneDto,
  UpdateMilestoneDto,
} from './dto';

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return (this.prisma.project as any).findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        milestones: {
          orderBy: { createdAt: 'asc' },
        },
        tasks: {
          where: { deletedAt: null },
          include: {
            assignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            pullRequests: true,
          },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        tickets: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            category: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findAll(query: ListProjectsQuery, organizationId?: string | null) {
    const {
      page = 1,
      limit = 20,
      status,
      clientId,
      search,
      sort = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (Number(page) - 1) * Number(limit);

    // Filter out soft-deleted projects
    const where: any = {
      deletedAt: null,
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (status) {
      where.status = status;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [projects, total] = await Promise.all([
      (this.prisma.project as any).findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sort]: sortOrder },
        include: {
          client: { select: { id: true, name: true } },
          milestones: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: { tasks: true },
          },
        },
      }),
      (this.prisma.project as any).count({ where }),
    ]);

    return {
      projects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(
    createProjectDto: CreateProjectDto,
    organizationId?: string | null,
  ) {
    // Project schema only has: name, description, clientId
    // budget/startDate/endDate are in the DTO but not in the DB schema
    const { name, description, clientId } = createProjectDto;
    return (this.prisma.project as any).create({
      data: {
        name,
        description,
        clientId,
        organizationId: organizationId || undefined,
        status: 'PLANNING',
        milestones: {
          create: {
            name: 'Project Kickoff',
            description: 'Initial project setup and kickoff meeting',
          },
        },
      },
      include: {
        client: { select: { id: true, name: true } },
        milestones: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    return (this.prisma.project as any).update({
      where: { id },
      data: updateProjectDto,
      include: {
        client: { select: { id: true, name: true } },
        milestones: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async updateStatus(id: string, status: string) {
    return (this.prisma.project as any).update({
      where: { id },
      data: { status },
      include: {
        milestones: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async softDelete(id: string) {
    // Soft delete associated tasks as well
    await (this.prisma.task as any).updateMany({
      where: { projectId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return (this.prisma.project as any).update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    await (this.prisma.task as any).updateMany({
      where: { projectId: id },
      data: { deletedAt: null },
    });
    return (this.prisma.project as any).update({
      where: { id },
      data: { deletedAt: null },
      include: {
        milestones: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  async countActiveTasks(projectId: string) {
    return (this.prisma.task as any).count({
      where: {
        projectId,
        status: { not: 'DONE' },
        deletedAt: null,
      },
    });
  }

  // Milestone operations
  async findMilestoneById(id: string) {
    return (this.prisma.milestone as any).findUnique({
      where: { id },
    });
  }

  async findMilestonesByProject(projectId: string) {
    return (this.prisma.milestone as any).findMany({
      where: { projectId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async getNextMilestoneOrderIndex(projectId: string) {
    const lastMilestone = await (this.prisma.milestone as any).findFirst({
      where: { projectId },
      orderBy: { orderIndex: 'desc' },
    });
    return (lastMilestone?.orderIndex ?? -1) + 1;
  }

  async createMilestone(
    projectId: string,
    createMilestoneDto: CreateMilestoneDto,
  ) {
    const orderIndex = await this.getNextMilestoneOrderIndex(projectId);

    return (this.prisma.milestone as any).create({
      data: {
        ...createMilestoneDto,
        projectId,
        orderIndex,
        status: 'PENDING',
      },
    });
  }

  async updateMilestone(id: string, updateMilestoneDto: UpdateMilestoneDto) {
    return (this.prisma.milestone as any).update({
      where: { id },
      data: updateMilestoneDto,
    });
  }

  async completeMilestone(id: string) {
    return (this.prisma.milestone as any).update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async deleteMilestone(id: string) {
    return (this.prisma.milestone as any).delete({
      where: { id },
    });
  }

  async getProjectStats(projectId: string) {
    const [taskCount, completedTaskCount, milestoneCount] = await Promise.all([
      (this.prisma.task as any).count({
        where: { projectId },
      }),
      (this.prisma.task as any).count({
        where: { projectId, status: 'DONE' },
      }),
      (this.prisma.milestone as any).count({
        where: { projectId },
      }),
    ]);

    return {
      taskCount,
      completedTaskCount,
      completionPercentage:
        taskCount > 0 ? (completedTaskCount / taskCount) * 100 : 0,
      milestoneCount,
      totalTimeLogged: 0,
    };
  }
}
