import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { TicketsRepository } from './tickets.repository';
import {
  CreateTicketDto,
  UpdateTicketDto,
  UpdateTicketStatusDto,
  ListTicketsQuery,
  CreateTicketCommentDto,
  TicketDto,
  ListTicketsResponseDto,
  TicketCommentDto,
} from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TicketsService {
  private readonly VALID_STATUSES = [
    'OPEN',
    'IN_PROGRESS',
    'PENDING_RESOLUTION',
    'RESOLVED',
    'CLOSED',
    'REOPENED',
  ];
  private readonly VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  // SLA hours by priority
  private readonly SLA_HOURS: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 24,
    MEDIUM: 72,
    LOW: 168, // 1 week
  };

  // Status transition rules
  private readonly ALLOWED_TRANSITIONS: Record<string, string[]> = {
    OPEN: ['IN_PROGRESS', 'CLOSED'],
    IN_PROGRESS: ['PENDING_RESOLUTION', 'OPEN'],
    PENDING_RESOLUTION: ['RESOLVED', 'IN_PROGRESS'],
    RESOLVED: ['CLOSED', 'REOPENED'],
    REOPENED: ['IN_PROGRESS'],
    CLOSED: ['REOPENED'],
  };

  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  async createTicket(
    createTicketDto: CreateTicketDto,
    user?: any,
  ): Promise<TicketDto> {
    // Validate priority
    if (!this.VALID_PRIORITIES.includes(createTicketDto.priority)) {
      throw new BadRequestException(
        `Invalid priority. Valid options: ${this.VALID_PRIORITIES.join(', ')}`,
      );
    }

    // Validate category is not empty
    if (
      !createTicketDto.category ||
      createTicketDto.category.trim().length === 0
    ) {
      throw new BadRequestException('Category must not be empty');
    }

    // Validate title and description
    if (!createTicketDto.title || createTicketDto.title.trim().length === 0) {
      throw new BadRequestException('Title must not be empty');
    }

    if (
      !createTicketDto.description ||
      createTicketDto.description.trim().length === 0
    ) {
      throw new BadRequestException('Description must not be empty');
    }

    // Calculate SLA deadline
    const slaHours = this.SLA_HOURS[createTicketDto.priority];
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + slaHours);

    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const ticket = await this.ticketsRepository.create(
      createTicketDto,
      slaDeadline,
      orgId,
    );
    return this.mapToTicketDto(ticket);
  }

  async listTickets(
    query: ListTicketsQuery,
    user?: any,
  ): Promise<ListTicketsResponseDto> {
    // Validate status if provided
    if (query.status && !this.VALID_STATUSES.includes(query.status)) {
      throw new BadRequestException(
        `Invalid status. Valid options: ${this.VALID_STATUSES.join(', ')}`,
      );
    }

    // Validate priority if provided
    if (query.priority && !this.VALID_PRIORITIES.includes(query.priority)) {
      throw new BadRequestException(
        `Invalid priority. Valid options: ${this.VALID_PRIORITIES.join(', ')}`,
      );
    }

    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const result = await this.ticketsRepository.findAll(query, orgId);

    return {
      tickets: result.tickets.map((t) => this.mapToTicketListItemDto(t)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getTicketById(id: string, user?: any): Promise<TicketDto> {
    const ticket = await this.ticketsRepository.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !ticket.organizationId ||
        ticket.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this ticket');
      }
    }

    return this.mapToTicketDto(ticket);
  }

  async updateTicket(
    id: string,
    updateTicketDto: UpdateTicketDto,
    user?: any,
  ): Promise<TicketDto> {
    const ticket = await this.ticketsRepository.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !ticket.organizationId ||
        ticket.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this ticket');
      }
    }

    // Validate priority if provided
    if (
      updateTicketDto.priority &&
      !this.VALID_PRIORITIES.includes(updateTicketDto.priority)
    ) {
      throw new BadRequestException(
        `Invalid priority. Valid options: ${this.VALID_PRIORITIES.join(', ')}`,
      );
    }

    // Validate category is not empty
    if (
      updateTicketDto.category &&
      updateTicketDto.category.trim().length === 0
    ) {
      throw new BadRequestException('Category must not be empty');
    }

    // Validate title is not empty
    if (updateTicketDto.title && updateTicketDto.title.trim().length === 0) {
      throw new BadRequestException('Title must not be empty');
    }

    // Validate description is not empty
    if (
      updateTicketDto.description &&
      updateTicketDto.description.trim().length === 0
    ) {
      throw new BadRequestException('Description must not be empty');
    }

    const updated = await this.ticketsRepository.update(id, updateTicketDto);
    return this.mapToTicketDto(updated);
  }

  async updateTicketStatus(
    id: string,
    updateStatusDto: UpdateTicketStatusDto,
    user?: any,
  ): Promise<TicketDto> {
    const ticket = await this.ticketsRepository.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !ticket.organizationId ||
        ticket.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this ticket');
      }
    }

    const newStatus = updateStatusDto.status;

    // Validate status
    if (!this.VALID_STATUSES.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status. Valid options: ${this.VALID_STATUSES.join(', ')}`,
      );
    }

    // Validate status transition
    const allowedTransitions = this.ALLOWED_TRANSITIONS[ticket.status];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${ticket.status} to ${newStatus}. Allowed transitions: ${allowedTransitions?.join(', ') || 'None'}`,
      );
    }

    // Set resolved/closed timestamps
    let resolvedAt = ticket.resolvedAt;
    let closedAt = ticket.closedAt;

    if (newStatus === 'RESOLVED' && !resolvedAt) {
      resolvedAt = new Date();
    }

    if (newStatus === 'CLOSED' && !closedAt) {
      closedAt = new Date();
    }

    if (newStatus === 'REOPENED') {
      resolvedAt = null;
      closedAt = null;
    }

    const updated = await this.ticketsRepository.updateStatus(
      id,
      newStatus,
      resolvedAt,
      closedAt,
    );

    // Propagate status change back to any tasks linked to this ticket
    if (newStatus === 'REOPENED') {
      await this.prisma.task.updateMany({
        where: { ticketId: id, deletedAt: null },
        data: { status: 'TODO' },
      });
    } else if (newStatus === 'RESOLVED' || newStatus === 'CLOSED') {
      await this.prisma.task.updateMany({
        where: { ticketId: id, deletedAt: null },
        data: { status: 'DONE' },
      });
    }

    return this.mapToTicketDto(updated);
  }

  async assignTicket(
    id: string,
    assignedToId: string,
    user?: any,
  ): Promise<TicketDto> {
    const ticket = await this.ticketsRepository.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !ticket.organizationId ||
        ticket.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this ticket');
      }
    }

    const assigned = await this.ticketsRepository.assign(id, assignedToId);
    this.notificationsService
      .handleTicketAssigned(id, assignedToId)
      .catch((err) => {
        console.error('Notification trigger error:', err);
      });
    return this.mapToTicketDto(assigned);
  }

  async deleteTicket(id: string, user?: any): Promise<{ message: string }> {
    const ticket = await this.ticketsRepository.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !ticket.organizationId ||
        ticket.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have permission to delete this ticket',
        );
      }
    }

    await this.ticketsRepository.softDelete(id);
    return { message: 'Ticket deleted successfully' };
  }

  async restoreTicket(id: string, user?: any): Promise<TicketDto> {
    const ticket = await this.ticketsRepository.findById(id);
    if (!ticket || !ticket.deletedAt) {
      throw new NotFoundException('Ticket not found or is not deleted');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !ticket.organizationId ||
        ticket.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this ticket');
      }
    }

    const restored = await this.ticketsRepository.restore(id);
    return this.mapToTicketDto(restored);
  }

  async addComment(
    ticketId: string,
    userId: string,
    createCommentDto: CreateTicketCommentDto,
    user?: any,
  ): Promise<TicketCommentDto> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !ticket.organizationId ||
        ticket.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this ticket');
      }
    }

    // Validate comment content
    if (
      !createCommentDto.content ||
      createCommentDto.content.trim().length === 0
    ) {
      throw new BadRequestException('Comment content must not be empty');
    }

    const comment = await this.ticketsRepository.createComment(
      ticketId,
      userId,
      createCommentDto,
    );
    this.notificationsService
      .handleTicketCommented(ticketId, userId)
      .catch((err) => {
        console.error('Notification trigger error:', err);
      });
    return this.mapToCommentDto(comment);
  }

  async getComments(
    ticketId: string,
    userRole?: string,
    user?: any,
  ): Promise<TicketCommentDto[]> {
    const ticket = await this.ticketsRepository.findById(ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !ticket.organizationId ||
        ticket.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this ticket');
      }
    }

    const comments =
      await this.ticketsRepository.findCommentsByTicket(ticketId);

    // Filter internal comments based on user role (only show internal comments to support staff)
    const isSupport =
      userRole &&
      ['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'].includes(userRole);

    return comments
      .filter((c) => !c.isInternal || isSupport)
      .map((c) => this.mapToCommentDto(c));
  }

  async deleteComment(
    commentId: string,
    user?: any,
  ): Promise<{ message: string }> {
    if (user?.userType === 'CUSTOMER') {
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
        include: { ticket: true },
      });
      if (!comment) throw new NotFoundException('Comment not found');
      if (
        comment.ticket?.organizationId &&
        comment.ticket.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have permission to delete this comment',
        );
      }
    }
    await this.ticketsRepository.deleteComment(commentId);
    return { message: 'Comment deleted successfully' };
  }

  private calculateSLABreach(ticket: any): boolean {
    // SLA is breached if resolved after deadline or still open past deadline
    if (ticket.resolvedAt && ticket.slaDeadline) {
      return new Date(ticket.resolvedAt) > new Date(ticket.slaDeadline);
    }

    // If still open and deadline has passed, SLA is breached
    if (!ticket.resolvedAt && ticket.slaDeadline) {
      return new Date() > new Date(ticket.slaDeadline);
    }

    return false;
  }

  private mapToTicketDto(ticket: any): TicketDto {
    return {
      id: ticket.id,
      clientId: ticket.clientId,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      assignedToId: ticket.assignedToId,
      slaDeadline: ticket.slaDeadline,
      slaBreached: this.calculateSLABreach(ticket),
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      comments: ticket.comments?.map((c: any) => this.mapToCommentDto(c)) || [],
      attachments: ticket.attachments || [],
      client: ticket.client,
      assignedTo: ticket.assignedTo,
      projectId: ticket.projectId,
      amcContractId: ticket.amcContractId,
      project: ticket.project,
      amcContract: ticket.amcContract,
    };
  }

  private mapToTicketListItemDto(ticket: any) {
    return {
      id: ticket.id,
      clientId: ticket.clientId,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      assignedToId: ticket.assignedToId,
      slaDeadline: ticket.slaDeadline,
      slaBreached: this.calculateSLABreach(ticket),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      client: ticket.client,
      assignedTo: ticket.assignedTo,
      projectId: ticket.projectId,
      amcContractId: ticket.amcContractId,
      project: ticket.project,
      amcContract: ticket.amcContract,
    };
  }

  private mapToCommentDto(comment: any): TicketCommentDto {
    return {
      id: comment.id,
      ticketId: comment.ticketId,
      userId: comment.userId || undefined,
      clientUserId: comment.clientUserId || undefined,
      content: comment.content,
      isInternal: comment.isInternal,
      createdAt: comment.createdAt,
      user: comment.user,
      clientUser: comment.clientUser,
    };
  }
}
