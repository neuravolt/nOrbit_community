import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  ListTicketsQuery,
  CreateTicketCommentDto,
} from './dto';

@Injectable()
export class TicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const ticket = await (this.prisma.ticket as any).findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        assignedTo: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            clientUser: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        project: true,
        amcContract: true,
      },
    });

    if (!ticket) return null;

    // Fetch linked tasks to get their IDs
    const linkedTasks = await (this.prisma.task as any).findMany({
      where: { ticketId: ticket.id, deletedAt: null },
      select: { id: true },
    });
    const taskIds = linkedTasks.map((t: any) => t.id);

    // Fetch attachments belonging to this ticket OR any linked tasks
    const attachments = await (this.prisma.attachment as any).findMany({
      where: {
        OR: [{ ticketId: ticket.id }, { taskId: { in: taskIds } }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        uploadedByClientUser: { select: { id: true, name: true } },
      },
    });

    return {
      ...ticket,
      attachments,
    };
  }

  async findAll(query: ListTicketsQuery, organizationId?: string | null) {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      clientId,
      assigneeId,
      search,
      sort = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (assigneeId) {
      where.assignedToId = assigneeId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      (this.prisma.ticket as any).findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sort]: sortOrder },
        include: {
          client: { select: { id: true, name: true } },
          assignedTo: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          project: true,
          amcContract: true,
        },
      }),
      (this.prisma.ticket as any).count({ where }),
    ]);

    return {
      tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(
    createTicketDto: CreateTicketDto,
    slaDeadline: Date,
    organizationId?: string | null,
  ) {
    return (this.prisma.ticket as any).create({
      data: {
        ...createTicketDto,
        organizationId: organizationId || undefined,
        status: 'OPEN',
        slaDeadline,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        assignedTo: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        comments: true,
      },
    });
  }

  async update(id: string, updateTicketDto: UpdateTicketDto) {
    return (this.prisma.ticket as any).update({
      where: { id },
      data: updateTicketDto,
      include: {
        client: { select: { id: true, name: true, email: true } },
        assignedTo: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async updateStatus(
    id: string,
    status: string,
    resolvedAt?: Date,
    closedAt?: Date,
  ) {
    const data: any = { status };
    if (resolvedAt) data.resolvedAt = resolvedAt;
    if (closedAt) data.closedAt = closedAt;

    return (this.prisma.ticket as any).update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true, email: true } },
        assignedTo: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async assign(id: string, assignedToId: string) {
    return (this.prisma.ticket as any).update({
      where: { id },
      data: { assignedToId },
      include: {
        client: { select: { id: true, name: true, email: true } },
        assignedTo: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async softDelete(id: string) {
    return (this.prisma.ticket as any).update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    return (this.prisma.ticket as any).update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  // Comments
  async createComment(
    ticketId: string,
    userId: string,
    createCommentDto: CreateTicketCommentDto,
  ) {
    return (this.prisma.comment as any).create({
      data: {
        ticketId,
        userId,
        ...createCommentDto,
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async findCommentsByTicket(ticketId: string) {
    return (this.prisma.comment as any).findMany({
      where: { ticketId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteComment(id: string) {
    return (this.prisma.comment as any).delete({
      where: { id },
    });
  }
}
