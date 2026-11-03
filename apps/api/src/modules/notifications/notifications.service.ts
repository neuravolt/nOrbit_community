import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '@neuravolt/shared-config';
import { Queue } from 'bullmq';
import {
  CreateNotificationDto,
  ListNotificationsQuery,
} from './dto/notification.dto';
import { PaymentConfigService } from '../payments/payment-config.service';

const TEMPLATES: Record<string, { title: string; message: string }> = {
  ticket_assigned: {
    title: 'Ticket Assigned',
    message: "Ticket '{{ticketTitle}}' has been assigned to you.",
  },
  ticket_commented: {
    title: 'New Comment on Ticket',
    message: "A new comment has been added to ticket '{{ticketTitle}}'.",
  },
  project_deadline: {
    title: 'Project Deadline Approaching',
    message: "Project '{{projectName}}' is approaching its deadline.",
  },
  amc_renewal: {
    title: 'AMC Contract Renewal Approaching',
    message: "AMC Contract '{{contractNumber}}' is expiring on {{endDate}}.",
  },
  invoice_overdue: {
    title: 'Invoice Overdue Notification',
    message: "Invoice '{{invoiceNumber}}' is past its due date.",
  },
};

@Injectable()
export class NotificationsService {
  private notificationQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly paymentConfigService?: PaymentConfigService,
  ) {
    this.notificationQueue = new Queue('notifications-queue', {
      connection: {
        url: AppConfig.redisUrl,
        maxRetriesPerRequest: null,
      },
    });
  }

  private async getPaymentConfigSafe() {
    if (this.paymentConfigService) {
      try {
        return await this.paymentConfigService.getPaymentConfig();
      } catch {
        // Fallback
      }
    }
    return {
      onlinePaymentEnabled: true,
      manualPaymentEnabled: true,
      activeOnlineGateway: 'CASHFREE' as const,
    };
  }

  renderTemplate(
    type: string,
    variables: Record<string, any>,
  ): { title: string; message: string } {
    const template = TEMPLATES[type];
    if (!template) {
      return { title: 'Notification', message: 'Notification received' };
    }

    let title = template.title;
    let message = template.message;

    for (const [key, val] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      title = title.replace(placeholder, String(val));
      message = message.replace(placeholder, String(val));
    }

    return { title, message };
  }

  async queueEmail(
    to: string,
    template: string,
    variables: Record<string, any>,
    subject?: string,
    attachments?: any[],
    options?: { entityType?: string; entityId?: string; clientId?: string },
  ) {
    await this.notificationQueue.add('email-job', {
      to,
      template,
      variables,
      subject,
      attachments,
      entityType: options?.entityType ?? null,
      entityId: options?.entityId ?? null,
      clientId: options?.clientId ?? null,
    });
  }

  getQuietHoursDelay(): number {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const startQuiet = 21 * 60 + 30; // 9:30 PM
    const endQuiet = 7 * 60 + 30; // 7:30 AM

    let isQuiet = false;
    if (startQuiet > endQuiet) {
      isQuiet =
        currentTimeInMinutes >= startQuiet || currentTimeInMinutes <= endQuiet;
    } else {
      isQuiet =
        currentTimeInMinutes >= startQuiet && currentTimeInMinutes <= endQuiet;
    }

    if (!isQuiet) return 0;

    const target = new Date(now);
    target.setHours(7, 30, 0, 0);
    if (currentTimeInMinutes >= startQuiet) {
      target.setDate(target.getDate() + 1);
    }

    return target.getTime() - now.getTime();
  }

  async queueInApp(
    userId: string,
    type: string,
    title: string,
    message: string,
    link?: string,
  ) {
    const delay = this.getQuietHoursDelay();
    await this.notificationQueue.add(
      'in-app-job',
      {
        userId,
        type,
        title,
        message,
        link,
      },
      delay > 0 ? { delay } : undefined,
    );
  }

  async createInApp(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        message: dto.message,
        type: dto.type,
        link: dto.link,
      },
    });
  }

  async listUserNotifications(userId: string, query: ListNotificationsQuery) {
    const where: any = { userId };

    if (query.read !== undefined) {
      where.read = query.read === true || query.read === 'true';
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification not found`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async remove(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification not found`);
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    return { success: true };
  }

  // --- Triggers / Event hook handlers ---

  async handleTicketAssigned(ticketId: string, assigneeId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) return;

    const { title, message } = this.renderTemplate('ticket_assigned', {
      ticketTitle: ticket.title,
    });

    // Queue in-app notification
    await this.queueInApp(
      assigneeId,
      'ticket_assigned',
      title,
      message,
      `/tickets/${ticketId}`,
    );

    // Queue email if assignee exists
    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeId },
    });
    if (assignee?.email) {
      const ticketNumber = ticket.id.slice(0, 8);
      await this.queueEmail(
        assignee.email,
        'ticket_assigned',
        {
          userName: `${assignee.firstName} ${assignee.lastName}`,
          ticketTitle: ticket.title,
          priority: ticket.priority ?? 'MEDIUM',
          ticketNumber,
          ctaLabel: 'View Ticket',
          ctaUrl: `${process.env.CLIENT_PORTAL_URL || 'https://teams.neuravolt.in/client'}/tickets/${ticketId}`,
        },
        `[TKT-${ticketNumber}] Support Assigned: ${ticket.title}`,
        undefined,
        {
          entityType: 'TICKET',
          entityId: ticketId,
          clientId: ticket.clientId,
        },
      );
    }
  }

  async handleTicketCommented(ticketId: string, commenterId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { assignedTo: true },
    });
    if (!ticket) return;

    const { title, message } = this.renderTemplate('ticket_commented', {
      ticketTitle: ticket.title,
    });

    // Notify assignee if comments exist (and not the commenter)
    if (ticket.assignedToId && ticket.assignedToId !== commenterId) {
      await this.queueInApp(
        ticket.assignedToId,
        'ticket_commented',
        title,
        message,
        `/tickets/${ticketId}`,
      );
      if (ticket.assignedTo?.email) {
        const ticketNumber = ticket.id.slice(0, 8);
        await this.queueEmail(
          ticket.assignedTo.email,
          'ticket_commented',
          {
            ticketTitle: ticket.title,
            ticketNumber,
            ctaLabel: 'View Ticket',
            ctaUrl: `${process.env.CLIENT_PORTAL_URL || 'https://teams.neuravolt.in/client'}/tickets/${ticketId}`,
          },
          `[TKT-${ticketNumber}] Support Update`,
          undefined,
          {
            entityType: 'TICKET',
            entityId: ticketId,
            clientId: ticket.clientId,
          },
        );
      }
    }
  }

  async handleProjectDeadlineApproaching(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          include: {
            assignments: {
              include: { user: true },
            },
          },
        },
      },
    });
    if (!project) return;

    const { title, message } = this.renderTemplate('project_deadline', {
      projectName: project.name,
    });

    // Find all users assigned to project tasks
    const userIds = new Set<string>();
    const users: any[] = [];
    for (const task of project.tasks) {
      for (const assign of task.assignments) {
        if (!userIds.has(assign.userId)) {
          userIds.add(assign.userId);
          users.push(assign.user);
        }
      }
    }

    const deadlineStr = project.dueDate
      ? project.dueDate.toLocaleDateString()
      : 'Approaching';
    const projectNumber = project.id.slice(0, 8);

    for (const user of users) {
      await this.queueInApp(
        user.id,
        'project_deadline',
        title,
        message,
        `/projects/${projectId}`,
      );
      if (user.email) {
        await this.queueEmail(
          user.email,
          'project_deadline',
          {
            projectName: project.name,
            userName: `${user.firstName} ${user.lastName}`,
            deadline: deadlineStr,
            ctaLabel: 'View Project',
            ctaUrl: `${process.env.CLIENT_PORTAL_URL || 'https://teams.neuravolt.in/client'}/projects/${projectId}`,
          },
          `[PRJ-${projectNumber}] Deadline Approaching: ${project.name}`,
          undefined,
          {
            entityType: 'PROJECT',
            entityId: projectId,
            clientId: project.clientId,
          },
        );
      }
    }
  }

  async handleAmcExpiring(contractId: string) {
    const contract = await this.prisma.amcContract.findUnique({
      where: { id: contractId },
      include: {
        client: {
          include: { contactPersons: true },
        },
      },
    });
    if (!contract) return;

    const formattedDate = contract.endDate.toLocaleDateString();
    const { title, message } = this.renderTemplate('amc_renewal', {
      contractNumber: contract.contractNumber,
      endDate: formattedDate,
    });

    // Notify SALES users
    const salesUsers = await this.prisma.user.findMany({
      where: { role: 'SALES' },
    });

    for (const sales of salesUsers) {
      await this.queueInApp(sales.id, 'amc_renewal', title, message, `/amc`);
      if (sales.email) {
        await this.queueEmail(
          sales.email,
          'amc_renewal',
          {
            contractNumber: contract.contractNumber,
            endDate: formattedDate,
            clientName: contract.client.name,
            ctaLabel: 'View AMC Contract',
            ctaUrl: `${process.env.CLIENT_PORTAL_URL || 'https://teams.neuravolt.in/client'}/amc/${contractId}`,
          },
          `[AMC-${contract.contractNumber}] Renewal Reminder`,
          undefined,
          {
            entityType: 'AMC_CONTRACT',
            entityId: contractId,
            clientId: contract.clientId,
          },
        );
      }
    }

    // Notify client primary contacts
    const primaryContacts = contract.client.contactPersons.filter(
      (c) => c.isPrimary,
    );
    for (const contact of primaryContacts) {
      if (contact.email) {
        await this.queueEmail(
          contact.email,
          'amc_renewal',
          {
            contractNumber: contract.contractNumber,
            endDate: formattedDate,
            clientName: contact.name,
            ctaLabel: 'View AMC Contract',
            ctaUrl: `${process.env.CLIENT_PORTAL_URL || 'https://teams.neuravolt.in/client'}/amc/${contractId}`,
          },
          `[AMC-${contract.contractNumber}] Renewal Reminder`,
          undefined,
          {
            entityType: 'AMC_CONTRACT',
            entityId: contractId,
            clientId: contract.clientId,
          },
        );
      }
    }
  }

  async handleQuoteSent(quoteId: string, pdfBuffer: Buffer) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { client: true },
    });
    if (!quote || !quote.client?.email) return;

    await this.queueEmail(
      quote.client.email,
      'quote_sent',
      {
        clientName: quote.client.name,
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        validUntil: quote.validUntil
          ? quote.validUntil.toLocaleDateString()
          : '—',
        ctaLabel: 'View Quote',
        ctaUrl: `${process.env.CLIENT_PORTAL_URL || 'https://teams.neuravolt.in/client'}/quotes/${quoteId}`,
      },
      `[QTN-${quote.quoteNumber}] ${quote.title}`,
      [
        {
          filename: `quote-${quote.quoteNumber}.pdf`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        },
      ],
      {
        entityType: 'QUOTE',
        entityId: quoteId,
        clientId: quote.clientId,
      },
    );
  }
  async handleInvoiceSent(invoiceId: string, pdfBuffer: Buffer) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true },
    });
    if (!invoice || !invoice.client?.email) return;

    const grandTotal = Number(invoice.grandTotal);
    const amountPaid = Number(invoice.amountPaid);
    const balanceDue = Number(invoice.balanceDue);

    const isPaid = balanceDue <= 0;
    const isPartial = amountPaid > 0 && balanceDue > 0;
    const isCreated = amountPaid === 0;

    const grandTotalFormatted = grandTotal.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const amountPaidFormatted = amountPaid.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const balanceDueFormatted = balanceDue.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    let statusDisplay = 'SENT';
    if (isPaid) {
      statusDisplay = 'PAID';
    } else if (isPartial) {
      statusDisplay = 'PARTIALLY_PAID';
    }

    let subject = `Invoice ${invoice.invoiceNumber} - ₹${balanceDueFormatted} Due`;
    if (isPaid) {
      subject = `Payment Confirmation - Invoice ${invoice.invoiceNumber} Paid`;
    } else if (isPartial) {
      subject = `Payment Received - ₹${amountPaidFormatted} | Balance ₹${balanceDueFormatted}`;
    }

    const paymentConfig = await this.getPaymentConfigSafe();
    const payBaseUrl =
      process.env.PUBLIC_PAY_URL || 'https://teams.neuravolt.in/pay';
    const invoiceUrl = `${payBaseUrl}/${invoiceId}`;

    const hasPaymentOption = Boolean(
      paymentConfig.onlinePaymentEnabled || paymentConfig.manualPaymentEnabled,
    );

    let ctaLabel: string | null = null;
    let ctaUrl: string | null = null;
    if (!isPaid && hasPaymentOption) {
      ctaLabel = isPartial ? 'Pay Remaining Balance' : 'Pay Invoice';
      ctaUrl = invoiceUrl;
    }

    await this.queueEmail(
      invoice.client.email,
      'invoice_sent',
      {
        clientName: invoice.client.name,
        invoiceNumber: invoice.invoiceNumber,
        grandTotal: grandTotalFormatted,
        amountPaid: amountPaidFormatted,
        balanceDue: balanceDueFormatted,
        dueDate: invoice.dueDate.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        status: statusDisplay,
        isPaid,
        isPartial,
        isCreated,
        onlinePaymentEnabled: paymentConfig.onlinePaymentEnabled,
        manualPaymentEnabled: paymentConfig.manualPaymentEnabled,
        activeOnlineGateway: paymentConfig.activeOnlineGateway,
        ctaLabel,
        ctaUrl,
      },
      subject,
      [
        {
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        },
      ],
      {
        entityType: 'INVOICE',
        entityId: invoiceId,
        clientId: invoice.clientId,
      },
    );
  }

  async handleInvoiceOverdue(
    invoiceId: string,
    daysOverdue: number,
    pdfBuffer?: Buffer,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true },
    });
    if (!invoice || !invoice.client?.email) return;

    const attachments = pdfBuffer
      ? [
          {
            filename: `invoice-${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer.toString('base64'),
            contentType: 'application/pdf',
          },
        ]
      : undefined;

    const paymentConfig = await this.getPaymentConfigSafe();
    const payBaseUrl =
      process.env.PUBLIC_PAY_URL || 'https://teams.neuravolt.in/pay';
    const balanceDue = Number(invoice.balanceDue ?? invoice.grandTotal);
    const balanceDueFormatted = balanceDue.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const hasPaymentOption = Boolean(
      paymentConfig.onlinePaymentEnabled || paymentConfig.manualPaymentEnabled,
    );
    const isOverduePaid = balanceDue <= 0;

    let ctaLabel: string | null = null;
    let ctaUrl: string | null = null;
    if (!isOverduePaid && hasPaymentOption) {
      ctaLabel = 'Pay Invoice';
      ctaUrl = `${payBaseUrl}/${invoiceId}`;
    }

    await this.queueEmail(
      invoice.client.email,
      'invoice_overdue',
      {
        clientName: invoice.client.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: balanceDueFormatted,
        balanceDue: balanceDueFormatted,
        dueDate: invoice.dueDate.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        onlinePaymentEnabled: paymentConfig.onlinePaymentEnabled,
        manualPaymentEnabled: paymentConfig.manualPaymentEnabled,
        activeOnlineGateway: paymentConfig.activeOnlineGateway,
        ctaLabel,
        ctaUrl,
      },
      `[INV-${invoice.invoiceNumber}] Overdue Reminder - ₹${balanceDueFormatted} Due`,
      attachments,
      {
        entityType: 'INVOICE',
        entityId: invoiceId,
        clientId: invoice.clientId,
      },
    );
  }

  async handleAmcHoursConsumed(contractId: string) {
    const contract = await this.prisma.amcContract.findUnique({
      where: { id: contractId },
      include: { client: { include: { contactPersons: true } } },
    });
    if (!contract) return;

    const variables = {
      contractNumber: contract.contractNumber,
      usedHours: contract.usedHours,
      totalHours: contract.totalHours,
      clientName: contract.client.name,
      ctaLabel: 'View AMC Contract',
      ctaUrl: `${process.env.CLIENT_PORTAL_URL || 'https://teams.neuravolt.in/client'}/amc/${contractId}`,
    };

    // Notify sales / support team internally
    const salesUsers = await this.prisma.user.findMany({
      where: { role: 'SALES' },
    });
    for (const sales of salesUsers) {
      if (sales.email) {
        await this.queueEmail(
          sales.email,
          'amc_hours_consumed',
          variables,
          `[AMC-${contract.contractNumber}] Hours Consumed Alert`,
          undefined,
          {
            entityType: 'AMC_CONTRACT',
            entityId: contractId,
            clientId: contract.clientId,
          },
        );
      }
    }

    // Notify client primary contacts
    const primaryContacts = contract.client.contactPersons.filter(
      (c) => c.isPrimary,
    );
    for (const contact of primaryContacts) {
      if (contact.email) {
        await this.queueEmail(
          contact.email,
          'amc_hours_consumed',
          {
            ...variables,
            clientName: contact.name,
          },
          `[AMC-${contract.contractNumber}] Hours Consumed Alert`,
          undefined,
          {
            entityType: 'AMC_CONTRACT',
            entityId: contractId,
            clientId: contract.clientId,
          },
        );
      }
    }
  }

  async handleClientPortalAccessCreated(
    email: string,
    name: string,
    tempPassword: string,
    clientId?: string,
  ) {
    await this.queueEmail(
      email,
      'client_portal_access_created',
      {
        clientName: name,
        email,
        password: tempPassword,
        loginUrl: `${process.env.CLIENT_PORTAL_URL || 'https://teams.neuravolt.in/client'}/login`,
      },
      'Welcome to NeuraVolt Client Portal: Access Created',
      undefined,
      clientId ? { clientId } : undefined,
    );
  }
}
