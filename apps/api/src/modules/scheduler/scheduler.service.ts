import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly billingService: BillingService,
  ) {}

  /**
   * Daily at 9 AM — flag overdue invoices and calculate overdue days.
   * Runs every day to keep the overdue status accurate.
   */
  @Cron('0 9 * * *')
  async flagOverdueInvoices() {
    this.logger.log('Running overdue invoice check...');
    try {
      const now = new Date();

      // Find invoices past due date that aren't fully paid/cancelled
      const overdueInvoices = await this.prisma.invoice.findMany({
        where: {
          dueDate: { lt: now },
          status: { in: ['draft', 'sent'] },
        },
        include: { client: true },
      });

      for (const inv of overdueInvoices) {
        const overdueDays = Math.floor(
          (now.getTime() - new Date(inv.dueDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        await this.prisma.invoice.update({
          where: { id: inv.id },
          data: { isOverdue: true, status: 'overdue', overdueDays },
        });

        // Trigger email notification for days overdue: 1, 3, 7
        if ([1, 3, 7].includes(overdueDays)) {
          await this.notificationsService.handleInvoiceOverdue(
            inv.id,
            overdueDays,
          );
        }
      }

      this.logger.log(`Flagged ${overdueInvoices.length} invoices as overdue`);

      await this.prisma.auditLog.create({
        data: {
          action: 'CRON_RUN',
          resourceType: 'SystemScheduler',
          resourceId: 'flagOverdueInvoices',
          metadata: {
            status: 'SUCCESS',
            message: `Flagged ${overdueInvoices.length} invoices as overdue.`,
          },
        },
      });
    } catch (err: any) {
      this.logger.error('Error flagging overdue invoices', err);
      try {
        await this.prisma.auditLog.create({
          data: {
            action: 'CRON_RUN',
            resourceType: 'SystemScheduler',
            resourceId: 'flagOverdueInvoices',
            metadata: {
              status: 'FAILED',
              error: err.message,
            },
          },
        });
      } catch (logErr) {
        this.logger.error('Failed to log cron error to audit log', logErr);
      }
    }
  }

  /**
   * Daily at 8 AM — check AMC contracts expiring in the next 30 days.
   */
  @Cron('0 8 * * *')
  async checkAmcExpiry() {
    this.logger.log('Running AMC expiry check...');
    try {
      const now = new Date();
      const in35Days = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000);

      const expiring = await this.prisma.amcContract.findMany({
        where: {
          endDate: { gt: now, lt: in35Days },
          status: 'ACTIVE',
          deletedAt: null,
        },
        include: { client: { select: { name: true, email: true } } },
      });

      let alertedCount = 0;
      for (const contract of expiring) {
        const daysRemaining = Math.ceil(
          (new Date(contract.endDate).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if ([7, 15, 30].includes(daysRemaining)) {
          this.logger.warn(
            `AMC contract ${contract.contractNumber} is expiring in ${daysRemaining} days`,
          );
          await this.notificationsService.handleAmcExpiring(contract.id);
          alertedCount++;
        }
      }

      await this.prisma.auditLog.create({
        data: {
          action: 'CRON_RUN',
          resourceType: 'SystemScheduler',
          resourceId: 'checkAmcExpiry',
          metadata: {
            status: 'SUCCESS',
            message: `Checked expiring AMC contracts. Sent ${alertedCount} expiration warnings.`,
          },
        },
      });
    } catch (err: any) {
      this.logger.error('Error checking AMC expiry', err);
      try {
        await this.prisma.auditLog.create({
          data: {
            action: 'CRON_RUN',
            resourceType: 'SystemScheduler',
            resourceId: 'checkAmcExpiry',
            metadata: {
              status: 'FAILED',
              error: err.message,
            },
          },
        });
      } catch (logErr) {
        this.logger.error('Failed to log cron error to audit log', logErr);
      }
    }
  }

  /**
   * Daily at 10 AM — check AMC contract hours consumed.
   */
  @Cron('0 10 * * *')
  async checkAmcHours() {
    this.logger.log('Running AMC hours consumption check...');
    try {
      const activeContracts = await this.prisma.amcContract.findMany({
        where: {
          status: 'ACTIVE',
          alertAt80Percent: false,
          deletedAt: null,
        },
      });

      let alertedCount = 0;
      for (const contract of activeContracts) {
        if (
          contract.totalHours > 0 &&
          contract.usedHours / contract.totalHours >= 0.8
        ) {
          await this.notificationsService.handleAmcHoursConsumed(contract.id);

          await this.prisma.amcContract.update({
            where: { id: contract.id },
            data: { alertAt80Percent: true },
          });
          alertedCount++;
        }
      }

      await this.prisma.auditLog.create({
        data: {
          action: 'CRON_RUN',
          resourceType: 'SystemScheduler',
          resourceId: 'checkAmcHours',
          metadata: {
            status: 'SUCCESS',
            message: `Checked AMC hours consumption. Sent ${alertedCount} 80% consumption warnings.`,
          },
        },
      });
    } catch (err: any) {
      this.logger.error('Error checking AMC hours', err);
      try {
        await this.prisma.auditLog.create({
          data: {
            action: 'CRON_RUN',
            resourceType: 'SystemScheduler',
            resourceId: 'checkAmcHours',
            metadata: {
              status: 'FAILED',
              error: err.message,
            },
          },
        });
      } catch (logErr) {
        this.logger.error('Failed to log cron error to audit log', logErr);
      }
    }
  }

  /**
   * Every Monday at 9 AM — auto-generate weekly AMC reports for active contracts.
   */
  @Cron('0 9 * * 1')
  async generateAmcWeeklyReports() {
    this.logger.log('Running AMC weekly report auto-generation...');
    try {
      const now = new Date();
      const periodEnd = new Date(now);
      const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const activeContracts = await this.prisma.amcContract.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true, contractNumber: true },
      });

      let generated = 0;
      for (const contract of activeContracts) {
        // Check if report already exists for this week
        const existing = await this.prisma.amcWeeklyReport.findFirst({
          where: {
            contractId: contract.id,
            periodStart: { gte: periodStart },
            periodEnd: { lte: periodEnd },
          },
        });
        if (existing) continue;

        // Gather stats for this period
        const [ticketsResolved, ticketsOpen, timeLogs] = await Promise.all([
          this.prisma.ticket.count({
            where: {
              amcContractId: contract.id,
              status: 'RESOLVED',
              updatedAt: { gte: periodStart, lte: periodEnd },
            },
          }),
          this.prisma.ticket.count({
            where: {
              amcContractId: contract.id,
              status: { in: ['OPEN', 'IN_PROGRESS'] },
            },
          }),
          this.prisma.timeLog.findMany({
            where: {
              amcContractId: contract.id,
              date: { gte: periodStart, lte: periodEnd },
            },
            select: { hours: true },
          }),
        ]);

        const hoursLogged = timeLogs.reduce((s, t) => s + (t.hours ?? 0), 0);
        const weekStr = `${periodEnd.getDate().toString().padStart(2, '0')}${periodEnd.toLocaleString('en', { month: 'short' }).toUpperCase()}${String(periodEnd.getFullYear()).slice(2)}`;
        const clientCode = contract.contractNumber
          .replace('AMC-', '')
          .replace(/-\d{4}$/, '');

        // Find a system user for compiledById
        const systemUser = await this.prisma.user.findFirst({
          where: { role: 'SUPER_ADMIN' },
        });
        if (!systemUser) continue;

        await this.prisma.amcWeeklyReport.create({
          data: {
            contractId: contract.id,
            reportNumber: `AMCR-${clientCode}-${weekStr}`,
            periodStart,
            periodEnd,
            hoursLogged,
            ticketsResolved,
            ticketsOpen,
            compiledById: systemUser.id,
            executiveSummary: `Auto-generated weekly report for ${contract.contractNumber}. Period: ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}.`,
          },
        });
        generated++;
      }

      this.logger.log(`Auto-generated ${generated} weekly AMC reports`);

      await this.prisma.auditLog.create({
        data: {
          action: 'CRON_RUN',
          resourceType: 'SystemScheduler',
          resourceId: 'generateAmcWeeklyReports',
          metadata: {
            status: 'SUCCESS',
            message: `Processed weekly AMC reports. Generated ${generated} reports.`,
          },
        },
      });
    } catch (err: any) {
      this.logger.error('Error auto-generating AMC reports', err);
      try {
        await this.prisma.auditLog.create({
          data: {
            action: 'CRON_RUN',
            resourceType: 'SystemScheduler',
            resourceId: 'generateAmcWeeklyReports',
            metadata: {
              status: 'FAILED',
              error: err.message,
            },
          },
        });
      } catch (logErr) {
        this.logger.error('Failed to log cron error to audit log', logErr);
      }
    }
  }

  /**
   * Run every day at 10 AM — generate due AMC recurring invoices.
   */
  @Cron('0 10 * * *')
  async generateAmcInvoices() {
    this.logger.log('Running daily AMC invoice generation...');
    try {
      const now = new Date();
      const activeContracts = await this.prisma.amcContract.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          nextBillingDate: {
            lte: now,
          },
        },
      });

      this.logger.log(
        `Found ${activeContracts.length} active AMC contracts due for invoicing`,
      );

      let generated = 0;
      for (const contract of activeContracts) {
        try {
          const inv = await this.billingService.createAmcInvoice(contract.id);
          this.logger.log(
            `Generated AMC invoice ${inv.invoiceNumber} for contract ${contract.contractNumber}`,
          );

          // Automatically publish and send the invoice to the client!
          await this.billingService.send(inv.id);
          this.logger.log(
            `Automatically sent AMC invoice ${inv.invoiceNumber} to client`,
          );

          generated++;
        } catch (err: any) {
          this.logger.error(
            `Failed to generate/send invoice for contract ${contract.contractNumber}: ${err.message}`,
          );
        }
      }
      this.logger.log(
        `AMC invoice run complete. Generated ${generated} invoices.`,
      );

      await this.prisma.auditLog.create({
        data: {
          action: 'CRON_RUN',
          resourceType: 'SystemScheduler',
          resourceId: 'generateAmcInvoices',
          metadata: {
            status: 'SUCCESS',
            message: `Processed active AMC contract invoices. Generated and sent ${generated} invoices.`,
          },
        },
      });
    } catch (err: any) {
      this.logger.error('Error generating AMC invoices', err);
      try {
        await this.prisma.auditLog.create({
          data: {
            action: 'CRON_RUN',
            resourceType: 'SystemScheduler',
            resourceId: 'generateAmcInvoices',
            metadata: {
              status: 'FAILED',
              error: err.message,
            },
          },
        });
      } catch (logErr) {
        this.logger.error('Failed to log cron error to audit log', logErr);
      }
    }
  }

  /**
   * Run every day at 9:30 AM — generate due Asset recurring invoices.
   */
  @Cron('30 9 * * *')
  async generateAssetInvoices() {
    this.logger.log('Running daily Asset invoice generation...');
    let generated = 0;
    try {
      const now = new Date();
      // Find active assets where renewalDate is due
      const activeAssets = await this.prisma.asset.findMany({
        where: {
          deletedAt: null,
          renewalDate: {
            lte: now,
          },
        },
      });

      this.logger.log(
        `Found ${activeAssets.length} active assets due for renewal`,
      );

      for (const asset of activeAssets) {
        try {
          const inv = await this.billingService.createAssetRenewalInvoice(
            asset.id,
          );
          this.logger.log(
            `Generated Asset renewal invoice ${inv.invoiceNumber} for asset ${asset.name}`,
          );

          // Automatically publish and send the invoice to the client!
          await this.billingService.send(inv.id);
          this.logger.log(
            `Automatically sent Asset renewal invoice ${inv.invoiceNumber} to client`,
          );

          generated++;
        } catch (err: any) {
          this.logger.error(
            `Failed to generate/send invoice for asset ${asset.name}: ${err.message}`,
          );
        }
      }
      this.logger.log(
        `Asset invoice run complete. Generated ${generated} invoices.`,
      );

      await this.prisma.auditLog.create({
        data: {
          action: 'CRON_RUN',
          resourceType: 'SystemScheduler',
          resourceId: 'generateAssetInvoices',
          metadata: {
            status: 'SUCCESS',
            message: `Processed active expiring assets. Generated and sent ${generated} invoices.`,
          },
        },
      });
    } catch (err: any) {
      this.logger.error('Error generating Asset invoices', err);
      try {
        await this.prisma.auditLog.create({
          data: {
            action: 'CRON_RUN',
            resourceType: 'SystemScheduler',
            resourceId: 'generateAssetInvoices',
            metadata: {
              status: 'FAILED',
              error: err.message,
            },
          },
        });
      } catch (logErr) {
        this.logger.error('Failed to log cron error to audit log', logErr);
      }
    }
  }

  /**
   * Daily — delete used, 30+ day old Guardian install tokens. AuditLog rows
   * for these tokens are never touched by this, so the audit trail stays
   * intact even after the token row itself is gone.
   */
  @Cron('0 3 * * *')
  async cleanupGuardianInstallTokens() {
    this.logger.log('Running Guardian install token cleanup...');
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await (this.prisma as any).guardianInstallToken.deleteMany(
        {
          where: { usedAt: { not: null, lt: cutoff } },
        },
      );
      this.logger.log(
        `Deleted ${result.count} used Guardian install tokens older than 30 days.`,
      );
    } catch (err: any) {
      this.logger.error('Error cleaning up Guardian install tokens', err);
    }
  }

  /**
   * Daily, 4 AM — prune GuardianMonitor rows older than 90 days. Confirmed live this session:
   * this table had 14.5M rows / ~6.9GB in production with NOTHING ever deleting old rows — every
   * heartbeat (throttled to ~1/minute/agent already, see recordByovpsHeartbeat/recordManagedHeartbeat)
   * writes a row forever. 90 days keeps enough history for trend/ML-forecast analysis
   * (ml-prediction.service.ts) while capping long-term growth.
   *
   * Deletes in small batches rather than one giant DELETE — on a table this size, a single
   * unbounded DELETE would hold row locks and generate WAL for however many million rows are
   * past the cutoff (likely most of the table, on the very first run), competing with live
   * heartbeat writes on a shared host. Same "never do it all at once on a shared host" discipline
   * as runNightlyGuardianScans below. A hard iteration cap is a safety valve, not an expected
   * limit — at 5,000/batch it would take 2,000 iterations to hit it.
   */
  @Cron('0 4 * * *')
  async pruneOldGuardianMonitors() {
    const RETENTION_DAYS = 90;
    const BATCH_SIZE = 5000;
    const MAX_BATCHES = 2000; // safety valve — see doc comment above
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    let totalDeleted = 0;
    try {
      for (let i = 0; i < MAX_BATCHES; i++) {
        const rows = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM guardian_monitors WHERE "timestamp" < ${cutoff} LIMIT ${BATCH_SIZE}
        `;
        if (rows.length === 0) break;
        await this.prisma.guardianMonitor.deleteMany({
          where: { id: { in: rows.map((r) => r.id) } },
        });
        totalDeleted += rows.length;
        if (rows.length < BATCH_SIZE) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (totalDeleted > 0) {
        this.logger.log(
          `Pruned ${totalDeleted} GuardianMonitor row(s) older than ${RETENTION_DAYS} days.`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Error pruning old GuardianMonitor rows (deleted ${totalDeleted} before failing)`,
        err,
      );
    }
  }

  /**
   * Every 5 minutes — sweep GuardianCommand rows past their expiresAt that
   * never reached a terminal state (still PENDING/DELIVERED/RUNNING, either
   * never picked up by the agent or stuck after exhausting retries) and mark
   * them EXPIRED, so a stale queued command doesn't linger indefinitely and
   * confuse an admin polling for its result.
   */
  @Cron('*/5 * * * *')
  async expireStaleGuardianCommands() {
    try {
      const result = await (this.prisma as any).guardianCommand.updateMany({
        where: {
          status: { in: ['PENDING', 'DELIVERED', 'RUNNING'] },
          expiresAt: { lt: new Date() },
        },
        data: { status: 'EXPIRED' },
      });
      if (result.count > 0) {
        this.logger.log(
          `Expired ${result.count} stale Guardian remote-operation commands.`,
        );
      }
    } catch (err: any) {
      this.logger.error('Error expiring stale Guardian commands', err);
    }
  }

  /**
   * Every 5 minutes — sweep AutonomousAction rows stuck in 'EXECUTING'. Normally this status is
   * transient (set right before the repair SSH command runs, cleared to COMPLETED/ROLLED_BACK/
   * FAILED within seconds) — a row still EXECUTING after 15 minutes means executeRepairAction
   * itself crashed or the process restarted mid-run, and since that method only accepts
   * 'PENDING_APPROVAL' as its entry state, a stuck row could otherwise never be retried or
   * re-approved. Marks it FAILED rather than silently leaving it inconsistent.
   */
  @Cron('*/5 * * * *')
  async expireStuckAutonomousActions() {
    try {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000);
      const result = await (this.prisma as any).autonomousAction.updateMany({
        where: { status: 'EXECUTING', updatedAt: { lt: cutoff } },
        data: {
          status: 'FAILED',
          verificationResult:
            'Marked FAILED: stuck in EXECUTING past the 15-minute stale threshold.',
        },
      });
      if (result.count > 0) {
        this.logger.warn(
          `Marked ${result.count} stuck Guardian autonomous action(s) as FAILED.`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        'Error sweeping stuck Guardian autonomous actions',
        err,
      );
    }
  }
}
