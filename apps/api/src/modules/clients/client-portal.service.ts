import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { AppConfig } from '@neuravolt/shared-config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { decrypt, getEncryptionKey } from '@neuravolt/shared-utils';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { BillingService } from '../billing/billing.service';
import { GuardianService } from '../guardian/guardian.service';
import { ExpiryReminderService } from '../guardian/services/expiry-reminder.service';
import { GuardianPlanService } from '../guardian/services/guardian-plan.service';
import { WebPushService } from '../guardian/services/web-push.service';
import { TelegramService } from '../guardian/services/telegram.service';
import { validateRestoreInput } from '../guardian/backup.policy';
import {
  FEATURE_LABEL,
  GuardianPlan as GuardianPlanName,
  PLAN_FEATURES,
  PLAN_LABEL,
  PLAN_SITE_LIMIT,
} from '../guardian/guardian-plan.policy';
import {
  DEFAULT_PREFS,
  validatePrefsInput,
} from '../guardian/notification-preference.policy';
import { WordPressSecurityScanService } from '../guardian/services/wordpress-security-scan.service';
import { calculateWebsiteMetrics } from '../guardian/resource-allocation.util';

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

@Injectable()
export class ClientPortalService {
  private readonly logger = new Logger(ClientPortalService.name);
  private readonly redis = new Redis(
    AppConfig.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    {
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 100, 2000),
    },
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyProfileService: CompanyProfileService,
    private readonly billingService: BillingService,
    private readonly guardianService: GuardianService,
    private readonly wordpressScanService: WordPressSecurityScanService,
    @Optional() private readonly expiryReminders?: ExpiryReminderService,
    @Optional() private readonly guardianPlans?: GuardianPlanService,
    @Optional() private readonly webPush?: WebPushService,
    @Optional() private readonly telegram?: TelegramService,
  ) {}

  // ── Guardian alert channels chosen by the client (client portal) ──

  async getClientNotificationPreferences(clientId: string) {
    const row = await this.prisma.guardianClientNotificationPreference
      .findUnique({ where: { clientId } })
      .catch(() => null);
    return {
      emailEnabled: row?.emailEnabled ?? true,
      telegramChatId: row?.telegramChatId ?? null,
      pushEnabled: row?.pushEnabled ?? true,
      telegramAvailable: !!this.telegram?.enabled,
      pushAvailable: !!this.webPush?.enabled,
      pushPublicKey: this.webPush?.publicKey ?? null,
      pushDevices: this.webPush?.enabled
        ? await this.webPush.countClient(clientId)
        : 0,
    };
  }

  async updateClientNotificationPreferences(clientId: string, body: any) {
    const data: {
      emailEnabled?: boolean;
      pushEnabled?: boolean;
      telegramChatId?: string | null;
    } = {};
    if (body == null || typeof body !== 'object')
      throw new BadRequestException('Body must be an object');
    if ('emailEnabled' in body) data.emailEnabled = !!body.emailEnabled;
    if ('pushEnabled' in body) data.pushEnabled = !!body.pushEnabled;
    if ('telegramChatId' in body) {
      const v = body.telegramChatId;
      if (v === null || v === '') data.telegramChatId = null;
      else if (typeof v === 'string' && /^-?\d{1,20}$/.test(v.trim()))
        data.telegramChatId = v.trim();
      else
        throw new BadRequestException(
          'telegramChatId must be a numeric Telegram chat id',
        );
    }
    await this.prisma.guardianClientNotificationPreference.upsert({
      where: { clientId },
      create: { clientId, ...data },
      update: data,
    });
    return this.getClientNotificationPreferences(clientId);
  }

  async testClientTelegram(clientId: string) {
    if (!this.telegram?.enabled)
      throw new BadRequestException(
        'Telegram alerts are not available yet. Please ask NeuraVolt support.',
      );
    const row =
      await this.prisma.guardianClientNotificationPreference.findUnique({
        where: { clientId },
      });
    if (!row?.telegramChatId)
      throw new BadRequestException('Save your Telegram chat id first.');
    return {
      ok: await this.telegram.send(
        row.telegramChatId,
        'NeuraVolt Guardian: Telegram alerts are working.',
      ),
    };
  }

  async subscribeClientPush(
    clientId: string,
    subscription: any,
    userAgent?: string,
  ) {
    if (!this.webPush)
      throw new BadRequestException('Browser notifications are not available.');
    return this.webPush.subscribeClient(clientId, subscription, userAgent);
  }

  async unsubscribeClientPush(clientId: string, endpoint: string) {
    if (!this.webPush) return { removed: 0 };
    return this.webPush.unsubscribeClient(clientId, endpoint);
  }

  async testClientPush(clientId: string) {
    if (!this.webPush?.enabled)
      throw new BadRequestException('Browser notifications are not available.');
    return {
      sent: await this.webPush.sendToClient(clientId, {
        title: 'NeuraVolt Guardian',
        body: 'Browser notifications are working.',
        url: '/alerts',
      }),
    };
  }

  // ── Backups of the client's own servers (client portal, read-only) ──

  async getClientBackups(clientId: string) {
    if (
      this.guardianPlans &&
      !(await this.guardianPlans.clientAllows(clientId, 'BACKUP'))
    ) {
      return {
        available: false,
        reason: 'Backups are part of the Guardian Enterprise plan.',
        servers: [],
      };
    }
    const agents = await this.prisma.guardianAgent.findMany({
      where: { deletedAt: null, server: { clientId, deletedAt: null } },
      select: { server: { select: { id: true, name: true, metadata: true } } },
    });
    const servers = agents
      .filter((a) => a.server)
      .map((a) => {
        const b = ((a.server.metadata as any) || {}).backup || {};
        const snapshots: { id: string; time: string }[] = Array.isArray(
          b.snapshots,
        )
          ? b.snapshots
          : [];
        return {
          assetId: a.server.id,
          name: a.server.name,
          protected:
            !!b.lastSuccessAt &&
            !b.lastError &&
            Date.now() - Date.parse(b.lastSuccessAt) < 48 * 3_600_000,
          lastSuccessAt: b.lastSuccessAt ?? null,
          lastRunFailed: !!b.lastError,
          snapshotCount: snapshots.length,
          snapshots: snapshots
            .slice(-10)
            .reverse()
            .map((s) => ({ id: String(s.id).slice(0, 16), time: s.time })),
          lastRestoreTest: b.lastDrill
            ? { ok: !!b.lastDrill.ok, at: b.lastDrill.at }
            : null,
        };
      });
    return { available: true, servers };
  }

  /**
   * The client asks for files to be restored. Restores are never run from the portal: this opens
   * a support ticket (and notifies admins), and the team runs the non-destructive side-folder
   * restore after checking with the client.
   */
  async requestClientRestore(
    clientId: string,
    assetId: string,
    body: { snapshot?: string; path?: string; note?: string },
  ) {
    if (
      this.guardianPlans &&
      !(await this.guardianPlans.clientAllows(clientId, 'BACKUP'))
    ) {
      throw new ForbiddenException(
        'Backups are part of the Guardian Enterprise plan.',
      );
    }
    const snapshot = String(body?.snapshot || 'latest');
    const path = String(body?.path || '');
    try {
      validateRestoreInput(snapshot, path);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, clientId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!asset) throw new NotFoundException('Server not found');
    const note = String(body?.note || '').slice(0, 1000);
    const ticket = await this.createTicket(clientId, {
      title: `Restore request: ${path} on ${asset.name}`,
      description: `Client requested a restore from Guardian backups.\n\nServer: ${asset.name}\nSnapshot: ${snapshot}\nPath: ${path}${note ? `\n\nNote from client:\n${note}` : ''}\n\nRun it from Guardian > Backups (restores to a side folder; live files are not overwritten).`,
      priority: 'HIGH',
      category: 'GUARDIAN_RESTORE',
    });
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'MANAGER'] as any },
        isActive: true,
      },
      select: { id: true },
    });
    for (const a of admins) {
      await this.prisma.notification
        .create({
          data: {
            userId: a.id,
            type: 'guardian_restore_request',
            title: `Restore request from a client: ${asset.name}`,
            message: `${path} (${snapshot})`,
            link: '/guardian/backups',
          },
        })
        .catch(() => undefined);
    }
    return { ticketId: ticket.id, status: 'REQUESTED' };
  }

  // ── Guardian plan Phase 7: client view of expiries and open security findings ──

  /** This client's Guardian plan and what it includes. */
  async getClientGuardianPlan(clientId: string) {
    const plan =
      ((await this.guardianPlans?.planForClient(
        clientId,
      )) as GuardianPlanName | null) || 'ENTERPRISE';
    const limit = PLAN_SITE_LIMIT[plan];
    const sitesCount = await this.prisma.asset
      .count({
        where: {
          clientId,
          deletedAt: null,
          type: {
            in: ['WEBSITE', 'DOMAIN', 'ADMIN_PANEL', 'API_SERVICE'] as any,
          },
        },
      })
      .catch(() => 0);
    const overLimit = limit !== null && sitesCount > limit;
    return {
      plan,
      label: PLAN_LABEL[plan],
      features: PLAN_FEATURES[plan].map((f) => FEATURE_LABEL[f]),
      siteLimit: limit,
      sitesCount,
      overLimit,
      upgradeMessage: overLimit
        ? `Your ${PLAN_LABEL[plan]} plan includes ${limit} monitored site. Upgrade to Pro for unlimited sites and full protection.`
        : null,
    };
  }

  /** SSL / domain / renewal dates for this client's own assets only. */
  async getClientExpiries(clientId: string) {
    if (!clientId || !this.expiryReminders) return [];
    const items = await this.expiryReminders.listExpiries({
      clientId,
      withinDays: 90,
    });
    const results: Array<{
      assetId: string;
      assetName: string;
      kind: any;
      expiresAt: string;
      daysLeft: number;
      status: any;
      overLimit: boolean;
    }> = [];
    for (const item of items) {
      const allowed = this.guardianPlans
        ? await this.guardianPlans.isAssetWithinPlanLimit(item.assetId)
        : true;
      results.push({
        assetId: item.assetId,
        assetName: item.assetName,
        kind: item.kind,
        expiresAt: item.expiresAt,
        daysLeft: item.daysLeft,
        status: item.status,
        overLimit: !allowed,
      });
    }
    return results;
  }

  /**
   * Open findings on this client's own assets. Key-reuse findings are excluded: their text names
   * other servers, which may belong to other clients.
   */
  async getClientFindings(clientId: string) {
    if (!clientId) return [];
    const rows = await this.prisma.securityFinding.findMany({
      where: {
        status: 'OPEN',
        source: { not: 'ATTACK_SURFACE_KEY_REUSE' },
        asset: { clientId, deletedAt: null },
      },
      orderBy: { detectedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        severity: true,
        findingType: true,
        evidence: true,
        detectedAt: true,
        asset: { select: { id: true, name: true } },
      },
    });
    const order: Record<string, number> = {
      EMERGENCY: 0,
      CRITICAL: 1,
      WARNING: 2,
      INFO: 3,
    };
    return rows
      .map((r) => {
        const e = (r.evidence ?? {}) as Record<string, any>;
        return {
          id: r.id,
          severity: r.severity,
          assetId: r.asset.id,
          assetName: r.asset.name,
          title:
            typeof e.title === 'string'
              ? e.title
              : String(r.findingType).replace(/_/g, ' ').toLowerCase(),
          detail: typeof e.detail === 'string' ? e.detail : '',
          fix: typeof e.fix === 'string' ? e.fix : '',
          detectedAt: r.detectedAt,
        };
      })
      .sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  }

  private getEncryptionKey(): string {
    return getEncryptionKey();
  }

  private decryptAndSanitizeMetadata(metadata: any): any {
    if (!metadata) return {};
    const result = { ...metadata };

    // Remove sensitive passwords entirely so they are never sent to the client portal
    delete result.rootPassword;
    delete result.adminPassword;
    delete result.controlPanelPassword;

    return result;
  }

  async getDashboardStats(clientId: string) {
    const [projectsCount, ticketsCount, invoicesCount, activeAmcCount] =
      await Promise.all([
        this.prisma.project.count({ where: { clientId, deletedAt: null } }),
        this.prisma.ticket.count({ where: { clientId, deletedAt: null } }),
        this.prisma.invoice.count({
          where: {
            clientId,
            deletedAt: null,
            status: { notIn: ['draft', 'cancelled', 'DRAFT', 'CANCELLED'] },
          },
        }),
        this.prisma.amcContract.count({
          where: { clientId, status: 'ACTIVE', deletedAt: null },
        }),
      ]);

    const [recentTickets, recentInvoices] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { clientId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.invoice.findMany({
        where: {
          clientId,
          deletedAt: null,
          status: { notIn: ['draft', 'cancelled', 'DRAFT', 'CANCELLED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      stats: {
        projectsCount,
        ticketsCount,
        invoicesCount,
        activeAmcCount,
      },
      recentTickets,
      recentInvoices,
    };
  }

  async getProjects(clientId: string) {
    return this.prisma.project.findMany({
      where: { clientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProjectDetails(clientId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        tasks: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        milestones: {
          orderBy: { createdAt: 'asc' },
          include: {
            tasks: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.clientId !== clientId)
      throw new ForbiddenException('Access denied');
    return project;
  }

  async getTickets(clientId: string) {
    return this.prisma.ticket.findMany({
      where: { clientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTicketDetails(clientId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deletedAt: null },
      include: {
        comments: {
          where: { isInternal: false },
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { firstName: true, lastName: true, role: true } },
            clientUser: { select: { name: true } },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.clientId !== clientId)
      throw new ForbiddenException('Access denied');

    // PRIVACY SHIELD: Alias internal staff names to "NeuraVolt Support Team" to shield developer identities
    const maskedComments = ticket.comments.map((c: any) => {
      if (c.user) {
        return {
          ...c,
          user: {
            firstName: 'NeuraVolt Support',
            lastName: 'Team',
            role: 'SUPPORT',
          },
        };
      }
      return c;
    });

    // Fetch linked tasks to get their IDs
    const linkedTasks = await this.prisma.task.findMany({
      where: { ticketId: ticket.id, deletedAt: null },
      select: { id: true },
    });
    const taskIds = linkedTasks.map((t) => t.id);

    // Fetch public attachments belonging to this ticket OR any associated tasks
    const attachments = await this.prisma.attachment.findMany({
      where: {
        OR: [{ ticketId: ticket.id }, { taskId: { in: taskIds } }],
        isInternal: false,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { firstName: true, lastName: true } },
        uploadedByClientUser: { select: { name: true } },
      },
    });

    const maskedAttachments = attachments.map((a: any) => {
      if (a.uploadedBy) {
        return {
          ...a,
          uploadedBy: { firstName: 'NeuraVolt Support', lastName: 'Team' },
        };
      }
      return a;
    });

    return {
      ...ticket,
      comments: maskedComments,
      attachments: maskedAttachments,
    };
  }

  async createTicket(clientId: string, dto: any) {
    const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr default SLA
    return this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority ?? 'MEDIUM',
        category: dto.category ?? 'SUPPORT',
        clientId,
        slaDeadline,
        projectId: dto.projectId || null,
        amcContractId: dto.amcContractId || null,
      },
    });
  }

  async addTicketComment(
    clientId: string,
    ticketId: string,
    clientUserId: string,
    content: string,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deletedAt: null },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.clientId !== clientId)
      throw new ForbiddenException('Access denied');

    const comment = await this.prisma.comment.create({
      data: {
        content,
        ticketId,
        clientUserId,
        isInternal: false,
      },
      include: {
        clientUser: { select: { name: true } },
      },
    });

    // REAL-TIME ALERT: Create notification for assigned staff / admins
    try {
      const recipientId = ticket.assignedToId;
      if (recipientId) {
        await (this.prisma as any).notification.create({
          data: {
            userId: recipientId,
            title: `New Client Comment on Ticket #${ticket.title}`,
            message: `${comment.clientUser?.name || 'Client'} replied: ${content.substring(0, 80)}...`,
            type: 'TICKET_COMMENT',
            isRead: false,
          },
        });
      }
    } catch (e) {
      // Non-blocking fallback
    }

    return comment;
  }

  async getQuotes(clientId: string) {
    return this.prisma.quote.findMany({
      where: { clientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuoteDetails(clientId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, deletedAt: null },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!quote) throw new NotFoundException('Quotation not found');
    if (quote.clientId !== clientId)
      throw new ForbiddenException('Access denied');
    return quote;
  }

  async acceptQuote(clientId: string, quoteId: string) {
    const quote = await this.getQuoteDetails(clientId, quoteId);
    if (quote.status !== 'SENT')
      throw new BadRequestException('Only SENT quotes can be accepted');

    const updatedQuote = await this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
      include: { lineItems: true },
    });

    // WORKFLOW AUTOMATION: Auto-create a Draft Project shell with quote items as milestones
    try {
      const existingProject = await this.prisma.project.findFirst({
        where: { name: `Project - ${quote.quoteNumber}` },
      });
      if (!existingProject) {
        await this.prisma.project.create({
          data: {
            name: `Project - ${quote.quoteNumber}`,
            description: `Auto-generated project shell for accepted quotation ${quote.quoteNumber}`,
            clientId: clientId,
            status: 'PLANNING',
            startDate: new Date(),
            budget: Number(quote.grandTotal) || 0,
            milestones: {
              create: (quote.lineItems || []).map(
                (item: any, index: number) => ({
                  name: item.description || `Milestone ${index + 1}`,
                  description: item.longDescription || '',
                  orderIndex: index + 1,
                  status: 'PENDING',
                }),
              ),
            },
          },
        });
      }
    } catch (e) {
      // Non-blocking fallback for workflow automation
    }

    return updatedQuote;
  }

  async rejectQuote(clientId: string, quoteId: string, reason?: string) {
    const quote = await this.getQuoteDetails(clientId, quoteId);
    if (quote.status !== 'SENT')
      throw new BadRequestException('Only SENT quotes can be rejected');
    return this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason ?? null,
      },
    });
  }

  async getInvoices(clientId: string) {
    return this.prisma.invoice.findMany({
      where: {
        clientId,
        deletedAt: null,
        status: { notIn: ['draft', 'cancelled', 'DRAFT', 'CANCELLED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { project: true },
    });
  }

  async getInvoiceDetails(clientId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
        client: true,
        project: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.clientId !== clientId)
      throw new ForbiddenException('Access denied');
    return invoice;
  }

  /** Create a real Razorpay Order for a client to pay via the hosted checkout widget. */
  async createRazorpayOrder(clientId: string, invoiceId: string) {
    const invoice = await this.getInvoiceDetails(clientId, invoiceId);
    if (invoice.status?.toUpperCase() === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    const credentials =
      await this.companyProfileService.getRazorpayCredentials();
    if (!credentials) {
      throw new BadRequestException(
        'Online payment is not enabled for this account.',
      );
    }

    const balance = Number(invoice.balanceDue ?? invoice.grandTotal) || 0;
    if (balance <= 0) {
      throw new BadRequestException('Nothing due on this invoice.');
    }

    const auth = Buffer.from(
      `${credentials.keyId}:${credentials.keySecret}`,
    ).toString('base64');
    const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(balance * 100), // paise
        currency: 'INR',
        receipt: invoice.invoiceNumber || invoiceId,
        notes: { invoiceId, clientId },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new BadRequestException(
        `Failed to create Razorpay order: ${errBody}`,
      );
    }
    const order = await res.json();

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: credentials.keyId,
    };
  }

  /** Verify a completed Razorpay checkout and record the real payment against the invoice. */
  async verifyRazorpayPayment(
    clientId: string,
    invoiceId: string,
    dto: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) {
    const invoice = await this.getInvoiceDetails(clientId, invoiceId);

    const credentials =
      await this.companyProfileService.getRazorpayCredentials();
    if (!credentials) {
      throw new BadRequestException(
        'Online payment is not enabled for this account.',
      );
    }

    const expectedSignature = crypto
      .createHmac('sha256', credentials.keySecret)
      .update(`${dto.razorpay_order_id}|${dto.razorpay_payment_id}`)
      .digest('hex');

    const sigBuf = Buffer.from(dto.razorpay_signature);
    const expectedBuf = Buffer.from(expectedSignature);
    const isValid =
      sigBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(sigBuf, expectedBuf);

    if (!isValid) {
      throw new BadRequestException('Payment signature verification failed.');
    }

    const balance = Number(invoice.balanceDue ?? invoice.grandTotal) || 0;
    await this.billingService.recordPayment(invoiceId, {
      amount: balance,
      method: 'RAZORPAY',
      transactionId: dto.razorpay_payment_id,
      notes: `Online checkout payment via Razorpay (order ${dto.razorpay_order_id})`,
    });

    return { success: true };
  }

  async getAmcContracts(clientId: string) {
    return this.prisma.amcContract.findMany({
      where: { clientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAmcContractDetails(clientId: string, amcId: string) {
    const amc = await this.prisma.amcContract.findFirst({
      where: { id: amcId, deletedAt: null },
      include: {
        weeklyReports: { orderBy: { periodEnd: 'desc' } },
        hourLogs: {
          orderBy: { loggedAt: 'desc' },
          include: {
            loggedBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
    if (!amc) throw new NotFoundException('AMC contract not found');
    if (amc.clientId !== clientId)
      throw new ForbiddenException('Access denied');

    // PRIVACY SHIELD: Alias staff names on hour logs
    const maskedHourLogs = (amc.hourLogs || []).map((h: any) => ({
      ...h,
      loggedBy: h.loggedBy
        ? { firstName: 'NeuraVolt Support', lastName: 'Team' }
        : undefined,
    }));

    return {
      ...amc,
      hourLogs: maskedHourLogs,
    };
  }

  async getWeeklyReportDetails(clientId: string, reportId: string) {
    const report = await this.prisma.amcWeeklyReport.findUnique({
      where: { id: reportId },
      include: {
        contract: true,
        compiledBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Weekly report not found');
    if (report.contract.clientId !== clientId)
      throw new ForbiddenException('Access denied');
    return report;
  }

  async getProfile(clientUserId: string) {
    const profile = await this.prisma.clientUser.findUnique({
      where: { id: clientUserId },
      include: { client: { select: { name: true } } },
    });
    if (!profile) throw new NotFoundException('Client user not found');
    return profile;
  }

  async updateProfile(
    clientUserId: string,
    dto: { name?: string; phone?: string },
  ) {
    const updatedUser = await this.prisma.clientUser.update({
      where: { id: clientUserId },
      data: {
        name: dto.name,
        phone: dto.phone,
      },
      include: { client: { select: { name: true } } },
    });

    await this.prisma.client.update({
      where: { id: updatedUser.clientId },
      data: {
        name: dto.name !== undefined ? dto.name : undefined,
        phone: dto.phone !== undefined ? dto.phone : undefined,
      },
    });

    return updatedUser;
  }

  // SENIOR-ENGINEER FIX: this endpoint had zero caching and fanned out one guardianMonitor
  // query per asset on EVERY single call, with no limit on how many times it could be invoked
  // concurrently. Confirmed live this session: the API process repeatedly ballooned from ~250MB
  // to 10-14GB within seconds, crash-looping via PM2's max-memory-restart — and a live capture
  // during one incident showed multiple guardian_monitors queries active concurrently, one of
  // which kept getting progressively SLOWER (1.4s -> 2.7s -> 9s -> 20s+) rather than completing.
  // That's the signature of a feedback spiral, not a single bad query: uncached, unbounded-
  // concurrency fan-out queries pile up under any load (multiple tabs, retries, a slow client),
  // each pile-up makes the next one slower, which lets more pile up, which drives real memory
  // pressure and swap thrashing — a spiral that can go from a flat baseline to gigabytes within
  // seconds, matching every incident observed. The fix already exists elsewhere in this codebase
  // (GuardianService.getDashboardOverview's 5s Redis cache) — this endpoint just never got it.
  // Short TTL cache + in-flight de-dup: repeated/concurrent calls for the same client within the
  // window share one execution instead of each re-running the full per-asset fan-out.
  private readonly inFlightAssetsFetch = new Map<string, Promise<any>>();

  async getAssets(clientId: string) {
    const cacheKey = `client_portal:assets:${clientId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e: any) {
      this.logger.warn(`Redis cache get error for client assets: ${e.message}`);
    }

    const existing = this.inFlightAssetsFetch.get(clientId);
    if (existing) return existing;

    const fetchPromise = this.getAssetsUncached(clientId)
      .then(async (result) => {
        try {
          await this.redis.setex(cacheKey, 5, JSON.stringify(result));
        } catch (e: any) {
          this.logger.warn(
            `Redis cache set error for client assets: ${e.message}`,
          );
        }
        return result;
      })
      .finally(() => {
        this.inFlightAssetsFetch.delete(clientId);
      });

    this.inFlightAssetsFetch.set(clientId, fetchPromise);
    return fetchPromise;
  }

  private async getAssetsUncached(clientId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { clientId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      assets.map(async (asset) => {
        const sanitizedMetadata = this.decryptAndSanitizeMetadata(
          asset.metadata,
        );

        let telemetry: any = null;
        if (asset.type === 'VPS' || asset.type === 'HOSTING') {
          const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
          // BUG FIX: this was the only unbounded guardianMonitor.findMany() in the entire
          // codebase (every sibling copy of this exact "recent monitors in the last 3 minutes"
          // pattern, e.g. GuardianService.getDashboardWebsites, bounds it with take: 60). Confirmed
          // live: this query balloon the API process from ~250MB to 6-10GB within seconds,
          // repeatedly triggering PM2's max-memory-restart kill, whenever a client portal page
          // load hit an asset whose 3-minute window unexpectedly matched far more rows than
          // the normal ~3 (one per agent heartbeat) — against a 14M+ row table, that has no
          // ceiling without an explicit take.
          const recentMonitors = await this.prisma.guardianMonitor.findMany({
            where: {
              websiteId: asset.id,
              timestamp: { gte: threeMinutesAgo },
            },
            orderBy: { timestamp: 'desc' },
            take: 60,
          });
          const latestMonitor =
            recentMonitors[0] ||
            (await this.prisma.guardianMonitor.findFirst({
              where: { websiteId: asset.id },
              orderBy: { timestamp: 'desc' },
            }));

          if (latestMonitor) {
            const agent = await this.prisma.guardianAgent.findUnique({
              where: { id: latestMonitor.agentId },
              include: { server: true },
            });

            const isOnline =
              agent &&
              agent.status === 'ACTIVE' &&
              agent.lastHeartbeat &&
              new Date(agent.lastHeartbeat) >= threeMinutesAgo;

            const hostAgent = agent as any;
            const hostServerMetadata = hostAgent?.server?.metadata
              ? this.decryptAndSanitizeMetadata(hostAgent.server.metadata)
              : {};
            const hostOsInfo = hostAgent?.osInfo;
            const hostCores = hostOsInfo?.cpu_cores
              ? parseFloat(hostOsInfo.cpu_cores)
              : hostServerMetadata.cpuCores
                ? parseFloat(hostServerMetadata.cpuCores)
                : hostServerMetadata.cpu
                  ? parseFloat(hostServerMetadata.cpu)
                  : null;

            let effectiveCpu = latestMonitor.cpuPercent
              ? Number(latestMonitor.cpuPercent)
              : null;
            if (recentMonitors.length > 0) {
              const maxCpu = Math.max(
                ...recentMonitors.map((m) =>
                  m.cpuPercent ? Number(m.cpuPercent) : 0,
                ),
              );
              effectiveCpu = maxCpu;
            }

            const websiteMetrics = calculateWebsiteMetrics({
              website: {
                id: asset.id,
                name: asset.name,
                clientId: asset.clientId,
                metadata: sanitizedMetadata,
                diskUsageMB: asset.diskUsageMB,
                type: asset.type,
              },
              latestMonitor: {
                ...latestMonitor,
                cpuPercent: effectiveCpu,
              },
              hostCores,
              isOnline: !!isOnline,
            });

            telemetry = {
              cpuUsagePercent:
                websiteMetrics.cpu.utilizationPercent !== null
                  ? websiteMetrics.cpu.utilizationPercent
                  : websiteMetrics.cpu.rawPercent,
              ramUsedMB: websiteMetrics.ram.usedMB,
              ramTotalMB:
                websiteMetrics.ram.allocatedMB ??
                latestMonitor.ramTotalMB ??
                null,
              diskUsedGB: websiteMetrics.storage.usedGB,
              diskTotalGB:
                websiteMetrics.storage.allocatedGB ??
                (latestMonitor.diskTotalGB
                  ? Number(latestMonitor.diskTotalGB)
                  : null),
              storageBreakdown: websiteMetrics.storage.breakdown,
              isOnline: !!isOnline,
            };
          }
        }

        // Load any active alerts for this asset
        const activeAlerts = await this.prisma.guardianAlert.findMany({
          where: { websiteId: asset.id, isResolved: false, status: 'ACTIVE' },
          select: {
            id: true,
            alertType: true,
            severity: true,
            message: true,
            createdAt: true,
          },
        });

        return {
          ...asset,
          metadata: sanitizedMetadata,
          telemetry,
          activeAlerts,
        };
      }),
    );
  }

  /**
   * Toggles active monitoring for a client's specific asset (website/domain/etc.).
   * Enforces the effective plan limit (standard plan or custom plan limit).
   */
  async toggleAssetMonitoring(
    clientId: string,
    assetId: string,
    isMonitored: boolean,
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, clientId, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found or unauthorized');
    }

    if (isMonitored) {
      if (this.guardianPlans) {
        const limit =
          await this.guardianPlans.effectiveLimitForClient(clientId);
        if (limit !== null && limit !== undefined) {
          const currentlyMonitored = await this.prisma.asset.count({
            where: {
              clientId,
              deletedAt: null,
              isMonitored: true,
              id: { not: assetId },
            },
          });
          if (currentlyMonitored >= limit) {
            throw new BadRequestException(
              `Plan limit reached. Your current plan allows monitoring up to ${limit} site${limit === 1 ? '' : 's'}. Please disable monitoring on another site or contact support to upgrade your plan.`,
            );
          }
        }
      }
    }

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: { isMonitored },
    });

    try {
      await this.redis.del(`client_portal:assets:${clientId}`);
    } catch {}

    return updated;
  }

  /**
   * PHASE 5: Client Portal "My Server" / Guardian Telemetry Endpoint
   * Enforces Dual Condition Gating Rule:
   * 1. Check if client has active Guardian subscription OR linked Guardian assets
   * 2. Returns filtered servers, websites, latest telemetry, and alerts for this client ONLY
   */
  async getHostingData(clientId: string) {
    // 1. Fetch client assets linked to Guardian agents
    const assets = await this.prisma.asset.findMany({
      where: {
        clientId,
        deletedAt: null,
        guardianAgentId: { not: null },
      },
      include: {
        guardianAgent: {
          include: {
            monitors: {
              take: 1,
              orderBy: { timestamp: 'desc' },
            },
            alerts: {
              where: { isResolved: false },
              take: 10,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    // Check if client has Private Guardian enabled or at least 1 active Guardian agent asset
    const hasGuardianAccess = assets.length > 0;

    const vpsAssets = assets.filter((a) => a.type === 'VPS');
    const websiteAssets = assets.filter(
      (a) => a.type === 'WEBSITE' || a.type === 'HOSTING',
    );

    const formattedVps = vpsAssets.map((asset) => {
      const agent = asset.guardianAgent;
      const latestMonitor = agent?.monitors?.[0] || null;
      return {
        id: asset.id,
        name: asset.name,
        guardianMode: asset.guardianMode,
        guardianOwnership: asset.guardianOwnership,
        guardianStatus: asset.guardianStatus,
        environment: asset.environment,
        agentId: (agent as any)?.agentId || agent?.id || null,
        hostname: agent?.hostname || null,
        publicIp: agent?.publicIp || null,
        version: agent?.version || null,
        metrics: latestMonitor
          ? {
              cpuPercent: latestMonitor.cpuPercent
                ? Number(latestMonitor.cpuPercent)
                : 0,
              ramUsedMB: latestMonitor.ramUsedMB || 0,
              ramTotalMB: latestMonitor.ramTotalMB || 0,
              healthScore: latestMonitor.healthScore || 100,
              lastHeartbeat: latestMonitor.timestamp,
            }
          : null,
        alerts: agent?.alerts || [],
      };
    });

    const formattedWebsites = websiteAssets.map((asset) => {
      const agent = asset.guardianAgent;
      const latestMonitor = agent?.monitors?.[0] || null;
      return {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        projectType: asset.projectType,
        sslIssuer: asset.sslIssuer,
        sslExpiryDate: asset.sslExpiryDate,
        diskUsageMB: asset.diskUsageMB,
        metrics: latestMonitor
          ? {
              ramUsedMB: latestMonitor.ramUsedMB || 0,
              cpuPercent: latestMonitor.cpuPercent
                ? Number(latestMonitor.cpuPercent)
                : 0,
              visitorsPerMin: latestMonitor.visitorsPerMin || 0,
              healthScore: latestMonitor.healthScore || 100,
            }
          : null,
      };
    });

    return {
      hasGuardianAccess,
      vpsServers: formattedVps,
      monitoredWebsites: formattedWebsites,
      totalServers: formattedVps.length,
      totalWebsites: formattedWebsites.length,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BYOVPS self-service onboarding — reuses the exact same GuardianService
  // bootstrap implementation the admin Fleet UI uses (generateInstallToken),
  // so there is only one onboarding implementation in the codebase. The only
  // thing this layer adds is the ownership check: a client may only act on a
  // BYOVPS asset they actually own. Managed VPS assets are never reachable
  // through here — they keep their existing (unrelated) workflow.
  // ──────────────────────────────────────────────────────────────────────────

  private async getOwnedByovpsAsset(clientId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        clientId,
        deletedAt: null,
        type: 'VPS',
        guardianMode: 'BYOVPS' as any,
      },
    });
    if (!asset) {
      throw new NotFoundException('BYOVPS server not found for this account.');
    }
    return asset;
  }

  async getByovpsOnboardingStatus(clientId: string, assetId: string) {
    const asset = await this.getOwnedByovpsAsset(clientId, assetId);
    const agent = asset.guardianAgentId
      ? await (this.prisma as any).guardianAgent.findUnique({
          where: { id: asset.guardianAgentId },
        })
      : null;

    return {
      assetId: asset.id,
      assetName: asset.name,
      guardianStatus: asset.guardianStatus,
      // Deliberately omits agentSecret, agentFingerprint, machineId — clients
      // never see these, admin-only via the Fleet UI's security panel.
      lastSeen: agent?.lastHeartbeat || null,
      agentVersion: agent?.version || null,
      connectedSince: agent?.connectedAt || null,
    };
  }

  async generateByovpsInstallCommand(
    clientId: string,
    assetId: string,
    createdBy: string,
  ) {
    await this.guardianPlans?.assertClient(clientId, 'BYOVPS_FLEET');
    await this.getOwnedByovpsAsset(clientId, assetId);
    // Same call the admin Fleet UI makes — no duplicate bootstrap logic.
    return this.guardianService.generateInstallToken({
      clientId,
      assetId,
      createdBy,
    });
  }

  // ── Guardian Client Health & Incident Operations ────────────────────────────

  async getClientSystemStatus(clientId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { clientId, deletedAt: null },
      select: { id: true, name: true },
    });
    const assetIds = assets.map((a) => a.id);

    const activeAlerts = await this.prisma.guardianAlert.findMany({
      where: {
        websiteId: { in: assetIds },
        isResolved: false,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        alertType: true,
        severity: true,
        websiteId: true,
        website: { select: { name: true } },
      },
    });

    let status:
      | 'ALL_OPERATIONAL'
      | 'DEGRADED'
      | 'ACTIVE_INCIDENT'
      | 'CRITICAL' = 'ALL_OPERATIONAL';
    if (
      activeAlerts.some(
        (a) => a.severity === 'EMERGENCY' || a.severity === 'CRITICAL',
      )
    ) {
      status = 'CRITICAL';
    } else if (activeAlerts.some((a) => a.severity === 'WARNING')) {
      status = 'ACTIVE_INCIDENT';
    } else if (activeAlerts.length > 0) {
      status = 'DEGRADED';
    }

    return {
      status,
      activeIncidentCount: activeAlerts.length,
      activeIncidents: activeAlerts.map((a) => ({
        id: a.id,
        severity: a.severity,
        type: a.alertType,
        assetName: a.website?.name || 'Service',
      })),
      updatedAt: new Date().toISOString(),
    };
  }

  async getClientIncidents(clientId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { clientId, deletedAt: null },
      select: { id: true, name: true, type: true },
    });
    const assetIds = assets.map((a) => a.id);

    const alerts = await this.prisma.guardianAlert.findMany({
      where: { websiteId: { in: assetIds } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        websiteId: true,
        alertType: true,
        severity: true,
        message: true,
        status: true,
        isResolved: true,
        resolvedAt: true,
        createdAt: true,
        website: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return alerts;
  }

  async getClientNotifications(clientId: string) {
    return this.prisma.guardianNotificationEvent.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  // ── Guardian Client Self-Service Security Operations ────────────────────────

  /** Quarantine / restore run over SSH; client-owned (BYOVPS) servers have no SSH access. */
  private assertManagedGuardianAsset(asset: any) {
    if (
      asset.guardianMode === 'BYOVPS' ||
      asset.guardianOwnership === 'CLIENT'
    ) {
      throw new BadRequestException(
        '1-Click Fix and Restore are not available yet for servers you host yourself. Please contact NeuraVolt support.',
      );
    }
  }

  async getClientWebsiteAlertsList(clientId: string, websiteId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: websiteId, clientId, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Website not found for this account.');
    }

    return this.prisma.guardianAlert.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true } },
        website: { select: { id: true, name: true } },
      },
    });
  }

  async oneClickFixClientAlert(
    clientId: string,
    websiteId: string,
    alertId: string,
    clientUserEmail: string,
  ) {
    await this.guardianPlans?.assertClient(clientId, 'ONE_CLICK_FIX');
    const asset = await this.prisma.asset.findFirst({
      where: { id: websiteId, clientId, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Website not found for this account.');
    }

    const alert = await this.prisma.guardianAlert.findFirst({
      where: { id: alertId, websiteId },
    });
    if (!alert) {
      throw new NotFoundException('Alert not found for this website.');
    }

    const agentId = asset.guardianAgentId || alert.agentId;
    if (!agentId) {
      throw new BadRequestException(
        'No Guardian agent connected to this website.',
      );
    }
    this.assertManagedGuardianAsset(asset);

    const details = (alert.details as any) || {};
    let filePaths: string[] = Array.isArray(details.suspiciousFiles)
      ? details.suspiciousFiles
      : [];

    if (filePaths.length === 0) {
      const domain =
        details.domain ||
        asset.name ||
        alert.message?.split(':')[0]?.trim() ||
        '';
      const sitePath =
        details.sitePath ||
        (domain ? `/var/www/fastuser/data/www/${domain}` : '');

      const muFiles = Array.isArray(details.newOrChangedMuPluginFiles)
        ? details.newOrChangedMuPluginFiles
        : [];
      const uploadFiles = Array.isArray(details.suspiciousUploadPhpFiles)
        ? details.suspiciousUploadPhpFiles
        : [];

      const resolvedMu = muFiles
        .map((f: any) => {
          const name = typeof f === 'string' ? f : f?.name;
          if (!name) return null;
          if (name.startsWith('/var/www/')) return name;
          return sitePath ? `${sitePath}/wp-content/mu-plugins/${name}` : null;
        })
        .filter(Boolean);

      const resolvedUploads = uploadFiles
        .map((f: any) => {
          const name = typeof f === 'string' ? f : f?.name;
          if (!name) return null;
          if (name.startsWith('/var/www/')) return name;
          return sitePath ? `${sitePath}/wp-content/uploads/${name}` : null;
        })
        .filter(Boolean);

      filePaths = [...resolvedMu, ...resolvedUploads] as string[];
    }

    filePaths = Array.from(
      new Set(
        filePaths.filter(
          (p) =>
            typeof p === 'string' &&
            p.startsWith('/var/www/') &&
            !p.includes('..'),
        ),
      ),
    );

    if (!filePaths || filePaths.length === 0) {
      throw new BadRequestException(
        'No specific suspicious file paths found in alert details to isolate.',
      );
    }

    const results: any[] = [];
    for (const filePath of filePaths) {
      const res = await this.wordpressScanService.quarantineWordPressFile(
        agentId,
        filePath,
        {
          purge: false,
          alertId,
          reason: alert.message || '1-Click Fix by Client Self-Service',
          // Prefix `CLIENT:` marks a client-initiated quarantine (the only kind a client may undo).
          quarantinedBy: `CLIENT:${clientUserEmail}`,
        },
      );
      results.push(res);
    }

    await this.prisma.guardianAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        isResolved: true,
        resolvedAt: new Date(),
      },
    });

    return {
      success: true,
      message: `${filePaths.length} suspicious file(s) quarantined successfully. Alert marked as resolved.`,
      quarantinedFiles: results,
    };
  }

  async getClientQuarantineRegistry(
    clientId: string,
    websiteId: string,
    status?: string,
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: websiteId, clientId, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Website not found for this account.');
    }

    if (!asset.guardianAgentId) {
      return [];
    }

    return this.wordpressScanService.getQuarantineRegistry(
      asset.guardianAgentId,
      {
        domain: asset.name,
        status,
      },
    );
  }

  async restoreClientQuarantinedFile(
    clientId: string,
    websiteId: string,
    recordId: string,
    clientUserEmail: string,
  ) {
    await this.guardianPlans?.assertClient(clientId, 'QUARANTINE');
    const asset = await this.prisma.asset.findFirst({
      where: { id: websiteId, clientId, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Website not found for this account.');
    }

    if (!asset.guardianAgentId) {
      throw new BadRequestException(
        'No Guardian agent connected to this website.',
      );
    }

    this.assertManagedGuardianAsset(asset);

    const record =
      await this.wordpressScanService.getQuarantineRecord(recordId);
    if (!record || record.domain !== asset.name) {
      throw new ForbiddenException(
        'Cannot restore file for a website you do not own.',
      );
    }
    // A client may undo its own 1-Click Fix. Files quarantined by NeuraVolt staff or automation
    // were judged malicious by us; putting one back live needs a staff decision.
    const clientQuarantined = (record.quarantinedBy || '').startsWith('CLIENT');
    if (!clientQuarantined) {
      throw new ForbiddenException(
        'This file was quarantined by the NeuraVolt security team. Please contact support to review a restore.',
      );
    }

    return this.wordpressScanService.restoreWordPressFile(
      asset.guardianAgentId,
      recordId,
      `CLIENT:${clientUserEmail}`,
    );
  }
}
