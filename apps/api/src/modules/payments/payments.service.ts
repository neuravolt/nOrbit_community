import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentConfigService } from './payment-config.service';
import { CashfreePaymentGateway } from './gateways/cashfree.gateway';
import { PaymentGatewayRegistry } from './gateways/payment-gateway.registry';
import { IPaymentGateway } from './gateways/payment-gateway.interface';
import { BillingService } from '../billing/billing.service';
import { CollectWalletService } from '../collects/services/collect-wallet.service';
import { CollectWebhookService } from '../collects/services/collect-webhook.service';

export interface OnlinePaymentSessionResult {
  paymentSessionId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly inFlightWebhooks = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentConfigService: PaymentConfigService,
    private readonly cashfreePaymentGateway: CashfreePaymentGateway,
    private readonly billingService: BillingService,
    @Optional()
    private readonly paymentGatewayRegistry?: PaymentGatewayRegistry,
    @Optional() private readonly collectWalletService?: CollectWalletService,
    @Optional() private readonly collectWebhookService?: CollectWebhookService,
  ) {}

  private getGatewayAdapter(provider: string = 'CASHFREE'): IPaymentGateway {
    if (this.paymentGatewayRegistry?.hasGateway(provider)) {
      return this.paymentGatewayRegistry.getGateway(provider);
    }
    return this.cashfreePaymentGateway;
  }

  /**
   * Creates or reuses a Cashfree payment session for an authentic client portal user.
   * Performs complete server-side authorization, status, and balance verification.
   */
  async createOnlinePaymentSession(
    clientId: string,
    invoiceId: string,
  ): Promise<OnlinePaymentSessionResult> {
    // 1. Authenticated user & client ownership check
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    // 2. Status verification
    if (invoice.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot create payment session for a cancelled invoice',
      );
    }

    if (invoice.status === 'paid') {
      throw new BadRequestException('Invoice is already fully paid');
    }

    if (invoice.status === 'draft') {
      throw new BadRequestException(
        'Invoice is in draft status and not yet payable',
      );
    }

    // 3. Amount integrity - strictly use server-side balanceDue
    const balance = Number(invoice.balanceDue);
    if (!Number.isFinite(balance) || balance <= 0) {
      throw new BadRequestException('Invoice has no balance due');
    }

    const payableAmount = Math.round(balance * 100) / 100;

    // 4. Payment configuration authority check
    // SaaS Plan upgrades (INV-SUB-*) must always be collected by NeuraVolt internal gateway (NeuraCollect)
    const isSubscriptionInvoice = invoice.invoiceNumber?.startsWith('INV-SUB-');
    const targetOrgId = isSubscriptionInvoice ? null : invoice.organizationId;

    const config = await this.paymentConfigService.getPaymentConfig(
      targetOrgId,
    );
    if (!config.onlinePaymentEnabled) {
      throw new BadRequestException('Online payments are currently disabled');
    }

    if (config.activeOnlineGateway !== 'CASHFREE') {
      throw new BadRequestException('Cashfree gateway is not active');
    }

    // 5. Verify Cashfree credentials
    const credentials =
      await this.paymentConfigService.getCashfreeCredentials(
        undefined,
        targetOrgId,
      );
    if (!credentials || !credentials.appId || !credentials.secretKey) {
      throw new ServiceUnavailableException(
        'Payment gateway credentials are not configured',
      );
    }

    // 6. Duplicate checkout protection: check for recent reusable PaymentAttempt (within 25 mins)
    const cutoffTime = new Date(Date.now() - 25 * 60 * 1000);
    const existingAttempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        gateway: 'CASHFREE',
        status: { in: ['CREATED', 'PENDING'] },
        paymentSessionId: { not: null },
        amount: payableAmount,
        createdAt: { gte: cutoffTime },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingAttempt && existingAttempt.paymentSessionId) {
      return {
        paymentSessionId: existingAttempt.paymentSessionId,
        gatewayOrderId: existingAttempt.gatewayOrderId,
        amount: existingAttempt.amount,
        currency: existingAttempt.currency,
      };
    }

    // 7. Create new PaymentAttempt with unique gatewayOrderId
    const sanitizedId = (invoice.invoiceNumber || invoice.id)
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(-15);
    const gatewayOrderId = `cf_${sanitizedId}_${Date.now()}`;

    const paymentAttempt = await this.prisma.paymentAttempt.create({
      data: {
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        gateway: 'CASHFREE',
        gatewayOrderId,
        amount: payableAmount,
        currency: 'INR',
        status: 'CREATED',
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
        },
      },
    });

    // 8. Call Cashfree gateway adapter to create order
    try {
      const orderResult = await this.cashfreePaymentGateway.createOrder({
        orderId: gatewayOrderId,
        amount: payableAmount,
        currency: 'INR',
        customer: {
          id: invoice.client.id,
          phone: invoice.client.phone || '9999999999',
          email: invoice.client.email || undefined,
          name: invoice.client.name || undefined,
        },
        orderNote: `Invoice #${invoice.invoiceNumber || invoice.id}`,
        orderTags: {
          invoiceId: invoice.id,
          paymentAttemptId: paymentAttempt.id,
        },
      });

      if (!orderResult.paymentSessionId) {
        throw new ServiceUnavailableException(
          'Cashfree did not return a payment session ID',
        );
      }

      // Update attempt to PENDING with session ID
      await this.prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          paymentSessionId: orderResult.paymentSessionId,
          status: 'PENDING',
        },
      });

      return {
        paymentSessionId: orderResult.paymentSessionId,
        gatewayOrderId,
        amount: payableAmount,
        currency: 'INR',
      };
    } catch (err: any) {
      await this.prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: { status: 'FAILED' },
      });
      throw err;
    }
  }

  /**
   * Processes Cashfree webhook:
   * 1. Validates webhook signature (HMAC-SHA256) & replay window.
   * 2. Finds correlated PaymentAttempt.
   * 3. Cross-verifies directly with Cashfree API.
   * 4. Enforces idempotency and concurrency guards.
   * 5. Converges strictly into BillingService.recordPayment().
   */
  async processCashfreeWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<{ success: boolean; message: string }> {
    // 1. Signature headers verification
    const signature =
      headers['x-webhook-signature'] ||
      headers['X-Webhook-Signature'] ||
      headers['x-webhook-signature'.toLowerCase()];
    const timestamp =
      headers['x-webhook-timestamp'] ||
      headers['X-Webhook-Timestamp'] ||
      headers['x-webhook-timestamp'.toLowerCase()];

    if (!signature || !timestamp || !rawBody) {
      throw new BadRequestException(
        'Missing required webhook signature headers or body',
      );
    }

    // 2. Parse payload safely to extract orderId
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Malformed JSON webhook payload');
    }

    const orderId =
      payload.data?.order?.order_id ||
      payload.order?.order_id ||
      payload.orderId;

    // 3. Correlate with internal PaymentAttempt using authoritative server-side record
    let paymentAttempt: any = null;
    let credentialsOverride: any = undefined;

    if (orderId) {
      paymentAttempt = await this.prisma.paymentAttempt.findUnique({
        where: { gatewayOrderId: orderId },
        include: { invoice: true, gatewayAccount: true },
      });

      if (paymentAttempt?.gatewayAccountId) {
        try {
          const resolved =
            await this.paymentConfigService.resolveGatewayAccount(
              'CASHFREE',
              paymentAttempt.environment || 'production',
              paymentAttempt.gatewayAccountId,
            );
          credentialsOverride = resolved.credentials;
        } catch (err: any) {
          this.logger.warn(
            `Could not resolve gateway account '${paymentAttempt.gatewayAccountId}' for order '${orderId}': ${err.message}`,
          );
        }
      }
    }

    const provider = paymentAttempt?.gateway || 'CASHFREE';
    const gatewayAdapter = this.getGatewayAdapter(provider);

    // 4. Verify cryptographic signature (using specific account credentials when available)
    const isValidSignature = await gatewayAdapter.verifyWebhookSignature({
      signature,
      timestamp,
      rawBody,
      credentialsOverride,
    });

    if (!isValidSignature) {
      this.logger.warn(
        `Rejected Cashfree webhook for order ${orderId || 'N/A'} due to invalid signature or expired timestamp`,
      );
      throw new UnauthorizedException(
        'Invalid Cashfree webhook signature or expired timestamp',
      );
    }

    if (!orderId) {
      return { success: true, message: 'Non-order webhook ignored' };
    }

    if (!paymentAttempt) {
      this.logger.warn(
        `Received webhook for unknown gateway order ID: ${orderId}`,
      );
      return { success: true, message: 'Payment attempt not found' };
    }

    // In-flight concurrency lock per gateway order ID: serialize concurrent webhook delivery
    if (this.inFlightWebhooks.has(orderId)) {
      try {
        await this.inFlightWebhooks.get(orderId);
      } catch {
        // Ignored; lock finished
      }
      const settledAttempt = await this.prisma.paymentAttempt.findUnique({
        where: { gatewayOrderId: orderId },
      });
      if (settledAttempt?.status === 'SUCCESS') {
        return { success: true, message: 'Payment attempt already reconciled' };
      }
    }

    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.inFlightWebhooks.set(orderId, lockPromise);

    try {
      // Terminal state protection: SUCCESS attempts can never be downgraded by out-of-order events
      if (paymentAttempt.status === 'SUCCESS') {
        return { success: true, message: 'Payment attempt already reconciled' };
      }

      // 5. Handle non-success statuses from webhook payload
      const payloadStatus = (
        payload.data?.payment?.payment_status ||
        payload.payment?.payment_status ||
        ''
      ).toUpperCase();

      if (['FAILED', 'USER_DROPPED', 'CANCELLED'].includes(payloadStatus)) {
        await this.prisma.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: payloadStatus,
            gatewayPaymentId: payload.data?.payment?.cf_payment_id
              ? String(payload.data.payment.cf_payment_id)
              : undefined,
          },
        });
        return {
          success: true,
          message: `Payment attempt marked as ${payloadStatus}`,
        };
      }

      // 6. Server-Side Gateway Verification
      // Never trust webhook SUCCESS alone without gateway API confirmation
      const verifiedStatus = await gatewayAdapter.fetchPaymentStatus(
        orderId,
        credentialsOverride,
      );

      if (!verifiedStatus || verifiedStatus.status !== 'SUCCESS') {
        this.logger.warn(
          `Server-side Cashfree check did not confirm SUCCESS for order ${orderId}. Status: ${verifiedStatus?.status}`,
        );
        if (verifiedStatus?.status === 'FAILED') {
          await this.prisma.paymentAttempt.update({
            where: { id: paymentAttempt.id },
            data: { status: 'FAILED' },
          });
        }
        return {
          success: true,
          message: 'Payment status not confirmed as SUCCESS by Cashfree server',
        };
      }

      // 7. Security verification: Currency & Amount checks (exact integer-paise comparison, 0 tolerance)
      const expectedCurrency = (paymentAttempt.currency || 'INR').toUpperCase();
      if (
        !verifiedStatus.currency ||
        verifiedStatus.currency.toUpperCase() !== expectedCurrency
      ) {
        this.logger.error(
          `Currency mismatch for order ${orderId}: expected ${expectedCurrency}, got ${verifiedStatus.currency}`,
        );
        return { success: false, message: 'Currency mismatch' };
      }

      const expectedPaise = Math.round(paymentAttempt.amount * 100);
      const verifiedPaise = Math.round(verifiedStatus.amount * 100);
      if (expectedPaise !== verifiedPaise) {
        this.logger.error(
          `Amount mismatch for order ${orderId}: expected ${paymentAttempt.amount} (${expectedPaise} paise), got ${verifiedStatus.amount} (${verifiedPaise} paise)`,
        );
        return { success: false, message: 'Payment amount mismatch' };
      }

      const verifiedPaymentId = String(
        verifiedStatus.paymentId ||
          payload.data?.payment?.cf_payment_id ||
          orderId,
      );

      // 8. Idempotency Check: Re-fetch attempt from database to guard against race conditions
      const freshAttempt = await this.prisma.paymentAttempt.findUnique({
        where: { id: paymentAttempt.id },
      });
      if (
        freshAttempt?.status === 'SUCCESS' ||
        paymentAttempt.status === 'SUCCESS'
      ) {
        return { success: true, message: 'Payment attempt already reconciled' };
      }

      // 9. AUTHORITATIVE ROUTING BASED ON SERVER-SIDE TRANSACTION OWNERSHIP
      // CASE A: Collects Application Order (appId is present, no invoiceId)
      if (paymentAttempt.appId && !paymentAttempt.invoiceId) {
        // Execute paymentAttempt update AND merchant wallet credit in a SINGLE atomic database transaction
        await this.prisma.$transaction(async (tx) => {
          // Step 1: Mark payment attempt as SUCCESS
          await tx.paymentAttempt.update({
            where: { id: paymentAttempt.id },
            data: {
              status: 'SUCCESS',
              gatewayPaymentId: verifiedPaymentId,
              metadata: {
                ...(typeof paymentAttempt.metadata === 'object'
                  ? paymentAttempt.metadata
                  : {}),
                reconciledAt: new Date().toISOString(),
                verifiedAmount: verifiedStatus.amount,
                isCollectsReconciled: true,
              },
            },
          });

          // Step 2: Transactional wallet credit within the SAME transaction
          if (this.collectWalletService && paymentAttempt.appId) {
            await this.collectWalletService.creditPaymentInTx(
              tx,
              paymentAttempt.appId,
              verifiedStatus.amount,
              paymentAttempt.id,
            );
          }
        });

        this.logger.log(
          `Reconciled Collects payment: appId=${paymentAttempt.appId}, externalOrderId=${paymentAttempt.externalOrderId || 'N/A'}, orderId=${orderId}, paymentId=${verifiedPaymentId}, amount=${verifiedStatus.amount}`,
        );

        // 10. Asynchronously queue outbound merchant webhook notification (decoupled from payment commit)
        if (this.collectWebhookService && paymentAttempt.appId) {
          try {
            await this.collectWebhookService.queueWebhookDelivery({
              appId: paymentAttempt.appId,
              eventType: 'payment.success',
              paymentAttemptId: paymentAttempt.id,
              verifiedPaymentId,
              verifiedAmount: verifiedStatus.amount,
            });
          } catch (webhookErr: any) {
            // Failure to enqueue outbound webhook MUST NEVER fail or roll back the committed payment/wallet credit
            this.logger.error(
              `Failed to queue outbound merchant webhook for app '${paymentAttempt.appId}': ${webhookErr.message}`,
            );
          }
        }

        return {
          success: true,
          message: 'Collects payment successfully verified and recorded',
        };
      }

      // CASE B: Legacy Invoice Order (invoiceId is present)
      if (paymentAttempt.invoiceId) {
        const existingPayment = await this.prisma.payment.findFirst({
          where: { transactionId: verifiedPaymentId },
        });

        if (existingPayment) {
          await this.prisma.paymentAttempt.update({
            where: { id: paymentAttempt.id },
            data: { status: 'SUCCESS', gatewayPaymentId: verifiedPaymentId },
          });
          return {
            success: true,
            message: 'Payment already recorded in accounting ledger',
          };
        }

        // Concurrency & Invoice balance re-check
        const currentInvoice = await this.prisma.invoice.findUnique({
          where: { id: paymentAttempt.invoiceId },
        });

        if (!currentInvoice || currentInvoice.status === 'cancelled') {
          this.logger.error(
            `Invoice ${paymentAttempt.invoiceId} cannot accept payment (missing or cancelled)`,
          );
          return { success: false, message: 'Invoice cannot accept payment' };
        }

        if (
          currentInvoice.status === 'paid' ||
          Number(currentInvoice.balanceDue) <= 0
        ) {
          await this.prisma.paymentAttempt.update({
            where: { id: paymentAttempt.id },
            data: { status: 'SUCCESS', gatewayPaymentId: verifiedPaymentId },
          });
          return { success: true, message: 'Invoice is already settled' };
        }

        // Single Accounting Sink: BillingService.recordPayment()
        const payableAmount = Math.min(
          verifiedStatus.amount,
          Number(currentInvoice.balanceDue),
        );

        await this.billingService.recordPayment(currentInvoice.id, {
          amount: payableAmount,
          method: 'ONLINE_CASHFREE',
          transactionId: verifiedPaymentId,
          notes: `Cashfree Online Payment (Order: ${orderId})`,
        });

        // Update PaymentAttempt to SUCCESS
        await this.prisma.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: 'SUCCESS',
            gatewayPaymentId: verifiedPaymentId,
            metadata: {
              ...(typeof paymentAttempt.metadata === 'object'
                ? paymentAttempt.metadata
                : {}),
              reconciledAt: new Date().toISOString(),
              verifiedAmount: verifiedStatus.amount,
            },
          },
        });

        this.logger.log(
          `Reconciled Cashfree payment: invoiceId=${currentInvoice.id}, paymentAttemptId=${paymentAttempt.id}, orderId=${orderId}, paymentId=${verifiedPaymentId}, amount=${payableAmount}`,
        );

        return {
          success: true,
          message: 'Payment successfully verified and recorded',
        };
      }

      return {
        success: false,
        message: 'Payment attempt has no valid invoice or application target',
      };
    } finally {
      if (orderId) {
        this.inFlightWebhooks.delete(orderId);
      }
      resolveLock();
    }
  }

  /**
   * Retrieves public invoice details and payment config for hosted checkout without login.
   */
  async getPublicInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        lineItems: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            method: true,
            createdAt: true,
            transactionId: true,
            notes: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const isSubscriptionInvoice = invoice.invoiceNumber?.startsWith('INV-SUB-');
    const targetOrgId = isSubscriptionInvoice ? null : invoice.organizationId;

    let companyProfile: any = null;
    if (targetOrgId) {
      companyProfile = await this.prisma.companyProfile.findUnique({
        where: { organizationId: targetOrgId },
      });
    }
    if (!companyProfile) {
      companyProfile = await this.prisma.companyProfile.findFirst({
        where: { organizationId: null },
      });
      if (!companyProfile) {
        companyProfile = await this.prisma.companyProfile.findFirst();
      }
    }
    const paymentConfig = await this.paymentConfigService.getPaymentConfig(
      targetOrgId,
    );

    return {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        subtotal: Number(invoice.subTotal || 0),
        taxRate: Number(invoice.taxRate || 0),
        taxTotal: Number(invoice.taxAmount || invoice.gstAmount || 0),
        grandTotal: Number(invoice.grandTotal || invoice.totalAmount || 0),
        amountPaid: Number(invoice.amountPaid || 0),
        balanceDue: Number(invoice.balanceDue || 0),
        notes: invoice.notes,
        terms: invoice.internalNotes,
        client: invoice.client,
        items: invoice.lineItems,
        payments: invoice.payments,
      },
      company: {
        companyName:
          companyProfile?.companyName || 'NeuraVolt Technology Pvt Ltd',
        logoUrl: companyProfile?.logoUrl
          ? companyProfile.logoUrl.startsWith('http') ||
            companyProfile.logoUrl.startsWith('/api')
            ? companyProfile.logoUrl
            : `/api${companyProfile.logoUrl.startsWith('/') ? '' : '/'}${companyProfile.logoUrl}`
          : null,
        gstin: companyProfile?.gstNumber || null,
        email: companyProfile?.email || null,
        phone: companyProfile?.phone || null,
        address: companyProfile?.address || null,
        bankName: companyProfile?.bankName || null,
        bankAccountNumber: companyProfile?.accountNumber || null,
        bankIfsc: companyProfile?.ifscCode || null,
        bankAccountName: companyProfile?.accountHolderName || null,
        upiId: companyProfile?.upiId || null,
        upiQrCodeUrl: null,
      },
      paymentConfig: {
        onlinePaymentEnabled: paymentConfig.onlinePaymentEnabled,
        manualPaymentEnabled: paymentConfig.manualPaymentEnabled,
        activeOnlineGateway: paymentConfig.activeOnlineGateway,
        cashfreeEnvironment: paymentConfig.cashfreeEnvironment,
      },
    };
  }

  /**
   * Creates a Cashfree payment session for public unauthenticated 1-click checkout.
   */
  async createPublicOnlinePaymentSession(
    invoiceId: string,
  ): Promise<OnlinePaymentSessionResult> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot create payment session for a cancelled invoice',
      );
    }

    if (invoice.status === 'paid') {
      throw new BadRequestException('Invoice is already fully paid');
    }

    if (invoice.status === 'draft') {
      throw new BadRequestException(
        'Invoice is in draft status and not yet payable',
      );
    }

    const balance = Number(invoice.balanceDue);
    if (!Number.isFinite(balance) || balance <= 0) {
      throw new BadRequestException('Invoice has no balance due');
    }

    const payableAmount = Math.round(balance * 100) / 100;

    const isSubscriptionInvoice = invoice.invoiceNumber?.startsWith('INV-SUB-');
    const targetOrgId = isSubscriptionInvoice ? null : invoice.organizationId;

    const config = await this.paymentConfigService.getPaymentConfig(
      targetOrgId,
    );
    if (!config.onlinePaymentEnabled) {
      throw new BadRequestException('Online payments are currently disabled');
    }

    if (config.activeOnlineGateway !== 'CASHFREE') {
      throw new BadRequestException('Cashfree gateway is not active');
    }

    const credentials =
      await this.paymentConfigService.getCashfreeCredentials(
        undefined,
        targetOrgId,
      );
    if (!credentials || !credentials.appId || !credentials.secretKey) {
      throw new ServiceUnavailableException(
        'Payment gateway credentials are not configured',
      );
    }

    const cutoffTime = new Date(Date.now() - 25 * 60 * 1000);
    const existingAttempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        gateway: 'CASHFREE',
        status: { in: ['CREATED', 'PENDING'] },
        paymentSessionId: { not: null },
        amount: payableAmount,
        createdAt: { gte: cutoffTime },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingAttempt && existingAttempt.paymentSessionId) {
      return {
        paymentSessionId: existingAttempt.paymentSessionId,
        gatewayOrderId: existingAttempt.gatewayOrderId,
        amount: existingAttempt.amount,
        currency: existingAttempt.currency,
      };
    }

    const sanitizedId = (invoice.invoiceNumber || invoice.id)
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(-15);
    const gatewayOrderId = `cf_${sanitizedId}_${Date.now()}`;

    const paymentAttempt = await this.prisma.paymentAttempt.create({
      data: {
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        gateway: 'CASHFREE',
        gatewayOrderId,
        amount: payableAmount,
        currency: 'INR',
        status: 'CREATED',
        environment:
          credentials.environment === 'production' ? 'PRODUCTION' : 'SANDBOX',
      },
    });

    const returnUrl = `https://teams.neuravolt.in/pay/${invoice.id}?order_id={order_id}`;

    const customerPhone = invoice.client.phone
      ? invoice.client.phone.replace(/[^0-9]/g, '').slice(-10)
      : '9999999999';

    try {
      const gatewayAdapter = this.getGatewayAdapter('CASHFREE');
      const order = await gatewayAdapter.createOrder({
        orderId: gatewayOrderId,
        amount: payableAmount,
        currency: 'INR',
        customer: {
          id: invoice.clientId,
          name: invoice.client.name,
          email: invoice.client.email || 'billing@neuravolt.in',
          phone: customerPhone.length === 10 ? customerPhone : '9999999999',
        },
        returnUrl,
      });

      if (!order.paymentSessionId) {
        throw new Error('Cashfree did not return a valid paymentSessionId');
      }

      await this.prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          paymentSessionId: order.paymentSessionId,
          status: 'PENDING',
        },
      });

      return {
        paymentSessionId: order.paymentSessionId,
        gatewayOrderId,
        amount: payableAmount,
        currency: 'INR',
      };
    } catch (err: any) {
      this.logger.error(
        `Cashfree Public createOrder error for invoice ${invoice.id}: ${err.message}`,
      );
      await this.prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: { status: 'FAILED' },
      });
      throw err;
    }
  }

  /**
   * Public Hosted Pay Endpoint: Synchronously checks payment status with Cashfree and reconciles invoice if settled.
   * Useful when returning from checkout or when modal closes, providing instant confirmation.
   */
  async syncPublicOrder(
    invoiceId: string,
    orderId: string,
  ): Promise<{ status: string; invoiceStatus?: string }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === 'paid' || Number(invoice.balanceDue) <= 0) {
      return { status: 'SUCCESS', invoiceStatus: invoice.status };
    }

    const paymentAttempt = await this.prisma.paymentAttempt.findFirst({
      where: { gatewayOrderId: orderId, invoiceId },
    });
    if (!paymentAttempt) {
      return { status: 'PENDING', invoiceStatus: invoice.status };
    }

    if (paymentAttempt.status === 'SUCCESS') {
      return { status: 'SUCCESS', invoiceStatus: 'paid' };
    }

    let credentialsOverride: any = undefined;
    if (paymentAttempt.gatewayAccountId) {
      try {
        const resolved = await this.paymentConfigService.resolveGatewayAccount(
          'CASHFREE',
          paymentAttempt.environment || 'production',
          paymentAttempt.gatewayAccountId,
        );
        credentialsOverride = resolved.credentials;
      } catch (err: any) {
        this.logger.warn(
          `Could not resolve gateway account for sync: ${err.message}`,
        );
      }
    }

    const gatewayAdapter = this.getGatewayAdapter('CASHFREE');
    const verifiedStatus = await gatewayAdapter.fetchPaymentStatus(
      orderId,
      credentialsOverride,
    );

    if (verifiedStatus && verifiedStatus.status === 'SUCCESS') {
      const verifiedPaymentId = String(verifiedStatus.paymentId || orderId);
      const payableAmount = Math.min(
        verifiedStatus.amount,
        Number(invoice.balanceDue),
      );

      const existingPayment = await this.prisma.payment.findFirst({
        where: { transactionId: verifiedPaymentId },
      });

      if (!existingPayment) {
        await this.billingService.recordPayment(invoice.id, {
          amount: payableAmount,
          method: 'ONLINE_CASHFREE',
          transactionId: verifiedPaymentId,
          notes: `Cashfree Online Payment (Order: ${orderId})`,
        });
      }

      await this.prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: 'SUCCESS',
          gatewayPaymentId: verifiedPaymentId,
        },
      });

      return { status: 'SUCCESS', invoiceStatus: 'paid' };
    }

    return {
      status: verifiedStatus?.status || 'PENDING',
      invoiceStatus: invoice.status,
    };
  }
}
