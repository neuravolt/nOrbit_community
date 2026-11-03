import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import Redis from 'ioredis';
import { AppConfig } from '@neuravolt/shared-config';

@Injectable()
export class ReportsService {
  private redis: Redis;

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis(AppConfig.redisUrl);
  }

  private async getOrSetCache<T>(
    key: string,
    fn: () => Promise<T>,
    ttl = 3600,
  ): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('Redis cache read error:', err);
    }

    const data = await fn();

    try {
      await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
    } catch (err) {
      console.error('Redis cache write error:', err);
    }

    return data;
  }

  async getWeeklySummary(startDate?: string, endDate?: string) {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const cacheKey = `reports:weekly:${start.getTime()}:${end.getTime()}`;

    return this.getOrSetCache(cacheKey, async () => {
      // 1. Tickets
      const ticketsCreated = await this.prisma.ticket.count({
        where: { createdAt: { gte: start, lte: end } },
      });

      const ticketsResolved = await this.prisma.ticket.count({
        where: {
          status: { in: ['RESOLVED', 'CLOSED'] },
          resolvedAt: { gte: start, lte: end },
        },
      });

      // 2. Projects
      const projectsStarted = await this.prisma.project.count({
        where: { createdAt: { gte: start, lte: end } },
      });

      const projectsCompleted = await this.prisma.project.count({
        where: {
          status: 'COMPLETED',
          updatedAt: { gte: start, lte: end },
        },
      });

      // 3. Hours logged per team member
      const timeLogs = await this.prisma.timeLog.groupBy({
        by: ['userId'],
        where: { date: { gte: start, lte: end } },
        _sum: { hours: true },
      });

      const userHours = await Promise.all(
        timeLogs.map(async (log) => {
          const user = await this.prisma.user.findUnique({
            where: { id: log.userId },
            select: { firstName: true, lastName: true, email: true },
          });
          return {
            userId: log.userId,
            userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            hours: log._sum.hours || 0,
          };
        }),
      );

      // 4. AMC Contracts
      const amcActive = await this.prisma.amcContract.count({
        where: { status: 'ACTIVE' },
      });
      const amcExpiring = await this.prisma.amcContract.count({
        where: {
          status: 'ACTIVE',
          endDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // next 30 days
        },
      });

      // 5. Overdue Invoices
      const overdueInvoicesCount = await this.prisma.invoice.count({
        where: { status: 'overdue' },
      });

      const overdueInvoicesSum = await this.prisma.invoice.aggregate({
        where: { status: 'overdue' },
        _sum: { grandTotal: true },
      });

      const totalHoursLogged = timeLogs.reduce(
        (sum, log) => sum + Number(log._sum.hours || 0),
        0,
      );

      const invoicesSentCount = await this.prisma.invoice.count({
        where: { status: 'sent', createdAt: { gte: start, lte: end } },
      });

      return {
        tickets: { created: ticketsCreated, resolved: ticketsResolved },
        projects: { started: projectsStarted, completed: projectsCompleted },
        teamProductivity: userHours,
        amcContracts: { active: amcActive, expiringNext30Days: amcExpiring },
        overdueInvoices: {
          count: overdueInvoicesCount,
          totalAmount: (overdueInvoicesSum._sum as any)?.grandTotal || 0,
        },
        newTickets: ticketsCreated,
        resolvedTickets: ticketsResolved,
        hoursLogged: totalHoursLogged,
        invoicesSent: invoicesSentCount,
      };
    });
  }

  async getTeamProductivity(
    userId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const cacheKey = `reports:productivity:${userId}:${start.getTime()}:${end.getTime()}`;

    return this.getOrSetCache(cacheKey, async () => {
      // 1. Tasks Completed
      const tasksCompleted = await this.prisma.task.count({
        where: {
          status: 'DONE',
          updatedAt: { gte: start, lte: end },
          assignments: { some: { userId } },
        },
      });

      // 2. Hours Logged
      const totalHoursLogged = await this.prisma.timeLog.aggregate({
        where: {
          userId,
          date: { gte: start, lte: end },
        },
        _sum: { hours: true },
      });

      // 3. Tickets Resolved
      const ticketsResolved = await this.prisma.ticket.count({
        where: {
          assignedToId: userId,
          status: { in: ['RESOLVED', 'CLOSED'] },
          resolvedAt: { gte: start, lte: end },
        },
      });

      return {
        userId,
        tasksCompleted,
        hoursLogged: totalHoursLogged._sum.hours || 0,
        ticketsResolved,
        startDate: start,
        endDate: end,
      };
    });
  }

  async getProjectProgress(projectId: string) {
    const cacheKey = `reports:project:${projectId}`;

    return this.getOrSetCache(cacheKey, async () => {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          milestones: true,
          tasks: {
            include: { timeLogs: true },
          },
        },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter(
        (t) => t.status === 'DONE',
      ).length;
      const progressPercent =
        totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Group tasks by status
      const tasksByStatus = {
        TODO: project.tasks.filter((t) => t.status === 'TODO').length,
        IN_PROGRESS: project.tasks.filter((t) => t.status === 'IN_PROGRESS')
          .length,
        REVIEW: project.tasks.filter((t) => t.status === 'REVIEW').length,
        DONE: completedTasks,
      };

      // Total hours logged
      let totalHoursLogged = 0;
      project.tasks.forEach((t) => {
        t.timeLogs.forEach((log) => {
          totalHoursLogged += log.hours;
        });
      });

      // Milestone Completion %
      const totalMilestones = project.milestones.length;
      let completedMilestones = 0;

      for (const milestone of project.milestones) {
        const milestoneTasks = await this.prisma.task.findMany({
          where: { milestoneId: milestone.id },
        });
        if (
          milestoneTasks.length > 0 &&
          milestoneTasks.every((t) => t.status === 'DONE')
        ) {
          completedMilestones++;
        }
      }

      const milestoneProgressPercent =
        totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

      // Find project deadline based on milestones or tasks
      let deadline: Date | null = null;
      project.milestones.forEach((m) => {
        if (m.dueDate) {
          if (!deadline || m.dueDate > deadline) deadline = m.dueDate;
        }
      });
      project.tasks.forEach((t) => {
        if (t.dueDate) {
          if (!deadline || t.dueDate > deadline) deadline = t.dueDate;
        }
      });

      let daysRemaining: number | null = null;
      if (deadline) {
        const diffTime = (deadline as Date).getTime() - Date.now();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return {
        projectId,
        projectName: project.name,
        progressPercent,
        milestoneCompletionPercent: milestoneProgressPercent,
        tasksByStatus,
        totalHoursLogged,
        daysRemaining,
        deadline,
      };
    });
  }

  /** Every live AMC contract at a glance: how many are active, expiring, expired, hours and value. */
  async getAmcPortfolioHealth(now = new Date()) {
    return this.getOrSetCache('reports:amc:portfolio', async () => {
      const contracts = await this.prisma.amcContract.findMany({
        where: { deletedAt: null },
        select: {
          status: true,
          endDate: true,
          totalHours: true,
          usedHours: true,
          monthlyValue: true,
          annualValue: true,
        },
      });
      const soon = new Date(now.getTime() + 30 * 86_400_000);
      const isExpired = (c: (typeof contracts)[number]) =>
        c.status === 'EXPIRED' || c.endDate < now;
      const active = contracts.filter(
        (c) => c.status === 'ACTIVE' && !isExpired(c),
      );
      const withHours = active.filter((c) => c.totalHours > 0);
      const value = active.reduce(
        (sum, c) =>
          sum +
          (c.annualValue
            ? Number(c.annualValue)
            : c.monthlyValue
              ? Number(c.monthlyValue) * 12
              : 0),
        0,
      );
      return {
        activeContracts: active.length,
        expiringSoon: active.filter((c) => c.endDate <= soon).length,
        expired: contracts.filter(isExpired).length,
        avgUsagePercent: withHours.length
          ? withHours.reduce(
              (sum, c) => sum + (c.usedHours / c.totalHours) * 100,
              0,
            ) / withHours.length
          : null,
        totalHoursRemaining: withHours.length
          ? Math.round(
              withHours.reduce(
                (sum, c) => sum + Math.max(0, c.totalHours - c.usedHours),
                0,
              ),
            )
          : null,
        totalContractValue: value > 0 ? Math.round(value) : null, // yearly value of active contracts
      };
    });
  }

  async getAmcHealth(contractId: string) {
    const cacheKey = `reports:amc:${contractId}`;

    return this.getOrSetCache(cacheKey, async () => {
      const contract = await this.prisma.amcContract.findUnique({
        where: { id: contractId },
        include: { hourLogs: true },
      });

      if (!contract) {
        throw new Error('AMC Contract not found');
      }

      // 1. Expiry countdown
      const diffTime = contract.endDate.getTime() - Date.now();
      const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 2. Support tickets count under contract
      const ticketsCount = await this.prisma.ticket.count({
        where: { clientId: contract.clientId },
      });

      return {
        contractId,
        contractNumber: contract.contractNumber,
        hoursTotal: contract.totalHours,
        hoursUsed: contract.usedHours,
        hoursRemaining: contract.totalHours - contract.usedHours,
        daysUntilExpiry,
        supportTicketsCount: ticketsCount,
        status: contract.status,
      };
    });
  }
}
