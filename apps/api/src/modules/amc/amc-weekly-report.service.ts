import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class AmcWeeklyReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyProfileService: CompanyProfileService,
  ) {}

  private getClientCode(clientName: string): string {
    return clientName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4);
  }

  private formatDateCode(date: Date): string {
    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    const d = date.getDate().toString().padStart(2, '0');
    const m = months[date.getMonth()];
    const y = date.getFullYear().toString().slice(-2);
    return `${d}${m}${y}`;
  }

  async generateReport(
    contractId: string,
    compiledById: string,
    periodStart?: Date,
    periodEnd?: Date,
    forceRegenerate = false,
    includeHours = false,
  ) {
    const contract = await this.prisma.amcContract.findUnique({
      where: { id: contractId },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!contract)
      throw new NotFoundException(`AMC contract ${contractId} not found`);

    const weekStart =
      periodStart ?? startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    const weekEnd = periodEnd ?? endOfWeek(new Date(), { weekStartsOn: 1 }); // Sunday
    const company = await this.companyProfileService.get();
    const prefix = company.amcPrefix ?? 'AMCR';
    const clientCode = this.getClientCode(contract.client.name);
    const reportNumber = `${prefix}-${clientCode}-${this.formatDateCode(weekEnd)}`;

    // Check if report already exists for this period
    const existing = await this.prisma.amcWeeklyReport.findFirst({
      where: {
        contractId,
        periodStart: { gte: startOfDay(weekStart) },
        periodEnd: { lte: endOfDay(weekEnd) },
      },
    });
    if (existing && !forceRegenerate)
      throw new BadRequestException(
        `Weekly report already exists for this period: ${existing.reportNumber}`,
      );

    // Auto-calculate from time logs
    const timeLogs = await this.prisma.timeLog.findMany({
      where: {
        amcContractId: contractId,
        date: { gte: weekStart, lte: weekEnd },
      },
    });
    const hoursLogged = timeLogs.reduce(
      (s: number, l: any) => s + Number(l.hours),
      0,
    );

    // Query real tasks assigned to this AMC contract
    const tasks = await this.prisma.task.findMany({
      where: {
        amcContractId: contractId,
      },
      select: {
        id: true,
        taskCode: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        assignments: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Query real tickets assigned to this AMC contract
    const tickets = await this.prisma.ticket.findMany({
      where: {
        amcContractId: contractId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        slaDeadline: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Map helper for tasks
    const mapTask = (t: any, displayStatus: string) => ({
      id: t.id,
      ticketId: t.taskCode || `TSK-${t.id.slice(0, 6).toUpperCase()}`,
      title: t.title,
      description:
        t.description && t.description.trim().length > 0
          ? t.description.trim()
          : 'Task deliverable tracked under client maintenance contract.',
      status: displayStatus,
      statusCode: t.status,
      type: 'Task',
      priority: t.priority || 'MEDIUM',
      assignedTo: t.assignments?.[0]?.user
        ? `${t.assignments[0].user.firstName} ${t.assignments[0].user.lastName}`
        : 'Assigned Team',
      dueDate: t.dueDate
        ? new Date(t.dueDate).toLocaleDateString('en-IN')
        : '—',
      updatedAt: t.updatedAt,
    });

    // Map helper for tickets
    const mapTicket = (t: any, displayStatus: string) => ({
      id: t.id,
      ticketId: `TICK-${t.id.slice(0, 6).toUpperCase()}`,
      title: t.title,
      description:
        t.description && t.description.trim().length > 0
          ? t.description.trim()
          : 'Support ticket resolved in accordance with SLA limits.',
      status: displayStatus,
      statusCode: t.status,
      type: t.category || 'Support Ticket',
      priority: t.priority || 'MEDIUM',
      assignedTo: 'Support Desk',
      dueDate: '—',
      updatedAt: t.updatedAt,
    });

    // 1. Completed Deliverables (DONE tasks, RESOLVED/CLOSED tickets)
    const completedDeliverables = [
      ...tasks
        .filter((t) => t.status === 'DONE')
        .map((t) => mapTask(t, 'Completed')),
      ...tickets
        .filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status))
        .map((t) => mapTicket(t, 'Completed')),
    ];

    // 2. In Review (REVIEW tasks, IN_REVIEW tickets)
    const inReview = [
      ...tasks
        .filter((t) => t.status === 'REVIEW')
        .map((t) => mapTask(t, 'In Review')),
      ...tickets
        .filter((t) => ['IN_REVIEW', 'PENDING_APPROVAL'].includes(t.status))
        .map((t) => mapTicket(t, 'In Review')),
    ];

    // 3. Ongoing Work (IN_PROGRESS tasks, IN_PROGRESS tickets)
    const ongoingWork = [
      ...tasks
        .filter((t) => t.status === 'IN_PROGRESS')
        .map((t) => mapTask(t, 'In Progress')),
      ...tickets
        .filter((t) => t.status === 'IN_PROGRESS')
        .map((t) => mapTicket(t, 'In Progress')),
    ];

    // 4. Upcoming Priorities (TODO / BACKLOG tasks, OPEN / NEW tickets)
    const upcomingPriorities = [
      ...tasks
        .filter((t) => ['TODO', 'BACKLOG'].includes(t.status))
        .map((t) => mapTask(t, 'Backlog')),
      ...tickets
        .filter((t) => ['OPEN', 'NEW', 'REOPENED'].includes(t.status))
        .map((t) => mapTicket(t, 'Backlog')),
    ];

    const overviewCounts = {
      completed: completedDeliverables.length,
      inReview: inReview.length,
      inProgress: ongoingWork.length,
      backlog: upcomingPriorities.length,
    };

    const ticketsResolved = tickets.filter((t: any) =>
      ['RESOLVED', 'CLOSED'].includes(t.status),
    ).length;
    const ticketsOpen = tickets.filter((t: any) =>
      ['OPEN', 'IN_PROGRESS', 'REOPENED'].includes(t.status),
    ).length;
    const bugsFixed = tickets.filter(
      (t: any) =>
        t.category?.toLowerCase().includes('bug') &&
        ['RESOLVED', 'CLOSED'].includes(t.status),
    ).length;
    const featuresAdded = tickets.filter(
      (t: any) =>
        t.category?.toLowerCase().includes('feature') &&
        ['RESOLVED', 'CLOSED'].includes(t.status),
    ).length;

    // Tasks completed
    const tasksCompleted = completedDeliverables.length;

    // SLA compliance
    const resolvedTickets = tickets.filter(
      (t: any) => ['RESOLVED', 'CLOSED'].includes(t.status) && t.resolvedAt,
    );
    let avgResolutionTime = 0;
    let slaCompliancePercent = 100.0;

    if (resolvedTickets.length > 0) {
      const totalResTime = resolvedTickets.reduce((acc: number, t: any) => {
        const res = t.resolvedAt
          ? new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()
          : 0;
        return acc + res;
      }, 0);
      avgResolutionTime =
        totalResTime / resolvedTickets.length / (1000 * 60 * 60); // hours

      const metSla = resolvedTickets.filter(
        (t: any) =>
          t.resolvedAt &&
          t.slaDeadline &&
          new Date(t.resolvedAt) <= new Date(t.slaDeadline),
      ).length;
      slaCompliancePercent = (metSla / resolvedTickets.length) * 100;
    }

    // Build effort summary from time logs
    const effortSummary = timeLogs.map((l: any) => ({
      activity: l.description ?? 'Development Work',
      hours: Number(l.hours),
      category: 'Development',
    }));
    if (effortSummary.length > 0) {
      effortSummary.push({
        activity: 'TOTAL',
        hours: hoursLogged,
        category: '',
        isTotal: true,
      } as any);
    }

    // Structured Scope Executed object
    const scopeExecuted = {
      overview: overviewCounts,
      completedDeliverables,
      inReview,
      ongoingWork,
      upcomingPriorities,
      items: [
        ...completedDeliverables,
        ...inReview,
        ...ongoingWork,
        ...upcomingPriorities,
      ],
    };

    const monitoringData = {
      includeHours: Boolean(includeHours),
      generatedAt: new Date().toISOString(),
      periodLabel: `${weekStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${weekEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      clientName: contract.client.name,
      overview: overviewCounts,
    };

    const executiveSummary = `AMC Service Report for ${contract.client.name} (${contract.contractNumber}). Period: ${weekStart.toLocaleDateString()} to ${weekEnd.toLocaleDateString()}. Delivery Overview: ${overviewCounts.completed} Completed, ${overviewCounts.inReview} In Review, ${overviewCounts.inProgress} In Progress, ${overviewCounts.backlog} Backlog.`;

    if (existing && forceRegenerate) {
      return this.prisma.amcWeeklyReport.update({
        where: { id: existing.id },
        data: {
          hoursLogged,
          ticketsResolved,
          ticketsOpen,
          bugsFixed,
          featuresAdded,
          tasksCompleted,
          avgResolutionTime,
          slaCompliancePercent,
          effortSummary:
            effortSummary.length > 0 ? (effortSummary as any) : null,
          scopeExecuted: scopeExecuted as any,
          monitoringData: monitoringData as any,
          deliverables: completedDeliverables as any,
          compiledById,
          executiveSummary,
        },
        include: {
          compiledBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          contract: { include: { client: true } },
        },
      });
    }

    return this.prisma.amcWeeklyReport.create({
      data: {
        contractId,
        reportNumber,
        periodStart: weekStart,
        periodEnd: weekEnd,
        hoursLogged,
        ticketsResolved,
        ticketsOpen,
        bugsFixed,
        featuresAdded,
        tasksCompleted,
        avgResolutionTime,
        slaCompliancePercent,
        effortSummary: effortSummary.length > 0 ? (effortSummary as any) : null,
        compiledById,
        executiveSummary,
        scopeExecuted: scopeExecuted as any,
        monitoringData: monitoringData as any,
        deliverables: completedDeliverables as any,
        observations: [],
        actionsTaken: [],
        deploymentSummary: {},
        keyAchievements: [],
        keyObservations: [],
        risks: [],
        nextActions: [],
        declaration:
          'We hereby declare that the deliverables and activities outlined above accurately represent the technical progress and support services rendered for this period.',
      },
      include: {
        compiledBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        contract: { include: { client: true } },
      },
    });
  }

  async listReports(contractId: string) {
    const contract = await this.prisma.amcContract.findUnique({
      where: { id: contractId },
    });
    if (!contract)
      throw new NotFoundException(`AMC contract ${contractId} not found`);

    return this.prisma.amcWeeklyReport.findMany({
      where: { contractId },
      orderBy: { periodEnd: 'desc' },
      include: {
        compiledBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getReport(reportId: string) {
    const report = await this.prisma.amcWeeklyReport.findUnique({
      where: { id: reportId },
      include: {
        compiledBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        contract: { include: { client: true } },
      },
    });
    if (!report) throw new NotFoundException(`Report ${reportId} not found`);
    return report;
  }

  async updateReport(reportId: string, dto: any) {
    await this.getReport(reportId);
    return this.prisma.amcWeeklyReport.update({
      where: { id: reportId },
      data: dto,
      include: {
        compiledBy: { select: { id: true, firstName: true, lastName: true } },
        contract: { include: { client: true } },
      },
    });
  }
}
