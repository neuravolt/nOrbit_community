import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PaymentConfigService } from '../payment-config.service';
import { CashfreePaymentGateway } from '../gateways/cashfree.gateway';
import { BillingService } from '../../billing/billing.service';

describe('Phase 4: Cashfree Online Checkout Flow & Webhook Reconciliation', () => {
  let service: PaymentsService;
  let mockPrisma: any;
  let mockPaymentConfigService: any;
  let mockCashfreeGateway: any;
  let mockBillingService: any;

  const mockClient = {
    id: 'client-101',
    name: 'Acme Enterprises',
    email: 'acme@example.com',
    phone: '9876543210',
  };

  const mockInvoice = {
    id: 'inv-201',
    clientId: 'client-101',
    invoiceNumber: 'INV-2026-001',
    status: 'unpaid',
    grandTotal: 10000,
    amountPaid: 0,
    balanceDue: 10000,
    assetId: 'asset-501',
    client: mockClient,
  };

  beforeEach(async () => {
    mockPrisma = {
      invoice: {
        findUnique: jest.fn(),
      },
      paymentAttempt: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      asset: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockPaymentConfigService = {
      getPaymentConfig: jest.fn().mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
      }),
      getCashfreeCredentials: jest.fn().mockResolvedValue({
        appId: 'CF_TEST_APP',
        secretKey: 'cf_sec_key',
        environment: 'sandbox',
        webhookSecret: 'cf_wh_sec',
      }),
      resolveGatewayAccount: jest.fn(),
    };

    mockCashfreeGateway = {
      createOrder: jest.fn(),
      fetchPaymentStatus: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };

    mockBillingService = {
      recordPayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentConfigService, useValue: mockPaymentConfigService },
        { provide: CashfreePaymentGateway, useValue: mockCashfreeGateway },
        { provide: BillingService, useValue: mockBillingService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. CHECKOUT FLOW (createOnlinePaymentSession)
  // =========================================================================
  describe('Checkout: createOnlinePaymentSession', () => {
    it('valid client creates session successfully with server-side balance', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.paymentAttempt.findFirst.mockResolvedValue(null);
      mockPrisma.paymentAttempt.create.mockResolvedValue({
        id: 'attempt-1',
        gatewayOrderId: 'cf_INV-2026-001_1726750000000',
        amount: 10000,
      });
      mockCashfreeGateway.createOrder.mockResolvedValue({
        gatewayOrderId: 'cf_INV-2026-001_1726750000000',
        paymentSessionId: 'cf_sess_live_12345',
        orderStatus: 'ACTIVE',
      });
      mockPrisma.paymentAttempt.update.mockResolvedValue({});

      const result = await service.createOnlinePaymentSession(
        'client-101',
        'inv-201',
      );

      expect(result).toEqual({
        paymentSessionId: 'cf_sess_live_12345',
        gatewayOrderId: expect.stringContaining('cf_'),
        amount: 10000,
        currency: 'INR',
      });

      expect(mockCashfreeGateway.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000,
          currency: 'INR',
          customer: expect.objectContaining({
            id: 'client-101',
            phone: '9876543210',
          }),
        }),
      );
    });

    it('wrong client cannot create session (IDOR protection)', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(
        service.createOnlinePaymentSession(
          'different-attacker-client',
          'inv-201',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects with NotFoundException when invoice does not exist', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.createOnlinePaymentSession('client-101', 'non-existent-inv'),
      ).rejects.toThrow(NotFoundException);
    });

    it('cancelled invoice rejected', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'cancelled',
      });

      await expect(
        service.createOnlinePaymentSession('client-101', 'inv-201'),
      ).rejects.toThrow(BadRequestException);
    });

    it('paid invoice rejected', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'paid',
        balanceDue: 0,
      });

      await expect(
        service.createOnlinePaymentSession('client-101', 'inv-201'),
      ).rejects.toThrow(BadRequestException);
    });

    it('draft invoice rejected', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'draft',
      });

      await expect(
        service.createOnlinePaymentSession('client-101', 'inv-201'),
      ).rejects.toThrow(BadRequestException);
    });

    it('zero or negative balance rejected', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        balanceDue: 0,
      });

      await expect(
        service.createOnlinePaymentSession('client-101', 'inv-201'),
      ).rejects.toThrow(BadRequestException);
    });

    it('online payments disabled in config rejected', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPaymentConfigService.getPaymentConfig.mockResolvedValue({
        onlinePaymentEnabled: false,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
      });

      await expect(
        service.createOnlinePaymentSession('client-101', 'inv-201'),
      ).rejects.toThrow(
        new BadRequestException('Online payments are currently disabled'),
      );
    });

    it('Cashfree not configured throws ServiceUnavailableException', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPaymentConfigService.getCashfreeCredentials.mockResolvedValue(null);

      await expect(
        service.createOnlinePaymentSession('client-101', 'inv-201'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('duplicate/concurrent checkout: safely reuses existing valid pending attempt', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      // Existing attempt within 25 minutes
      mockPrisma.paymentAttempt.findFirst.mockResolvedValue({
        id: 'attempt-reused',
        gatewayOrderId: 'cf_INV-2026-001_1726750000000',
        paymentSessionId: 'cf_sess_reused_9999',
        amount: 10000,
        currency: 'INR',
        status: 'PENDING',
      });

      const result = await service.createOnlinePaymentSession(
        'client-101',
        'inv-201',
      );

      expect(result).toEqual({
        paymentSessionId: 'cf_sess_reused_9999',
        gatewayOrderId: 'cf_INV-2026-001_1726750000000',
        amount: 10000,
        currency: 'INR',
      });

      // Crucial: gateway createOrder must NOT be called when reusing
      expect(mockCashfreeGateway.createOrder).not.toHaveBeenCalled();
      expect(mockPrisma.paymentAttempt.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. WEBHOOK SECURITY & RECONCILIATION (processCashfreeWebhook)
  // =========================================================================
  describe('Webhook: processCashfreeWebhook', () => {
    const rawSuccessWebhook = JSON.stringify({
      data: {
        order: {
          order_id: 'cf_INV-2026-001_100',
          order_amount: 5000,
          order_currency: 'INR',
        },
        payment: {
          cf_payment_id: 88776655,
          payment_status: 'SUCCESS',
          payment_amount: 5000,
          payment_currency: 'INR',
        },
      },
      event_time: '2026-09-19T13:00:00Z',
      type: 'PAYMENT_SUCCESS_WEBHOOK',
    });

    const validHeaders = {
      'x-webhook-signature': 'mock_valid_sig',
      'x-webhook-timestamp': '1726750000',
    };

    it('missing signature headers rejected with BadRequestException', async () => {
      await expect(
        service.processCashfreeWebhook(rawSuccessWebhook, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('invalid signature rejected with UnauthorizedException', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(false);

      await expect(
        service.processCashfreeWebhook(rawSuccessWebhook, validHeaders),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('malformed JSON body rejected with BadRequestException', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);

      await expect(
        service.processCashfreeWebhook('not-json-payload', validHeaders),
      ).rejects.toThrow(BadRequestException);
    });

    it('unknown PaymentAttempt returns graceful acknowledgement without error', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue(null);

      const res = await service.processCashfreeWebhook(
        rawSuccessWebhook,
        validHeaders,
      );
      expect(res).toEqual({
        success: true,
        message: 'Payment attempt not found',
      });
      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
    });

    it('failed payment event updates PaymentAttempt to FAILED and does not record payment', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-failed-test',
        gatewayOrderId: 'cf_INV-2026-001_100',
        status: 'PENDING',
      });

      const failedWebhook = JSON.stringify({
        data: {
          order: { order_id: 'cf_INV-2026-001_100' },
          payment: { cf_payment_id: 1234, payment_status: 'FAILED' },
        },
      });

      const res = await service.processCashfreeWebhook(
        failedWebhook,
        validHeaders,
      );
      expect(res.success).toBe(true);
      expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith({
        where: { id: 'attempt-failed-test' },
        data: { status: 'FAILED', gatewayPaymentId: '1234' },
      });
      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
    });

    it('server-side Cashfree check not confirming SUCCESS halts reconciliation', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        gatewayOrderId: 'cf_INV-2026-001_100',
        amount: 5000,
        invoiceId: 'inv-201',
      });
      // Server-side Cashfree query returns PENDING or FAILED
      mockCashfreeGateway.fetchPaymentStatus.mockResolvedValue({
        status: 'PENDING',
        paymentId: '88776655',
        amount: 5000,
        currency: 'INR',
      });

      const res = await service.processCashfreeWebhook(
        rawSuccessWebhook,
        validHeaders,
      );
      expect(res.success).toBe(true);
      expect(res.message).toContain('Payment status not confirmed as SUCCESS');
      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
    });

    it('mismatched amount between gateway verification and PaymentAttempt rejected', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        gatewayOrderId: 'cf_INV-2026-001_100',
        amount: 5000,
        invoiceId: 'inv-201',
      });
      mockCashfreeGateway.fetchPaymentStatus.mockResolvedValue({
        status: 'SUCCESS',
        paymentId: '88776655',
        amount: 100, // Gateway amount is different from attempt amount!
        currency: 'INR',
      });

      const res = await service.processCashfreeWebhook(
        rawSuccessWebhook,
        validHeaders,
      );
      expect(res).toEqual({
        success: false,
        message: 'Payment amount mismatch',
      });
      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
    });

    it('exact integer-paise comparison rejects 1 paise mismatch (0.01 tolerance test)', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        gatewayOrderId: 'cf_INV-2026-001_100',
        amount: 5000.0,
        currency: 'INR',
        invoiceId: 'inv-201',
      });
      mockCashfreeGateway.fetchPaymentStatus.mockResolvedValue({
        status: 'SUCCESS',
        paymentId: '88776655',
        amount: 5000.01, // 1 paise difference (500000 paise vs 500001 paise)
        currency: 'INR',
      });

      const res = await service.processCashfreeWebhook(
        rawSuccessWebhook,
        validHeaders,
      );
      expect(res).toEqual({
        success: false,
        message: 'Payment amount mismatch',
      });
      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
    });

    it('concurrent callbacks: second callback does not duplicate processing when first marks attempt SUCCESS', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      let status = 'PENDING';
      mockPrisma.paymentAttempt.findUnique.mockImplementation(() =>
        Promise.resolve({
          id: 'attempt-concurrent',
          gatewayOrderId: 'cf_INV-2026-001_100',
          status,
          amount: 5000,
          currency: 'INR',
          invoiceId: 'inv-201',
        }),
      );
      mockCashfreeGateway.fetchPaymentStatus.mockResolvedValue({
        status: 'SUCCESS',
        paymentId: '88776655',
        amount: 5000,
        currency: 'INR',
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-201',
        status: 'unpaid',
        balanceDue: 5000,
      });
      mockPrisma.paymentAttempt.update.mockImplementation((args: any) => {
        if (args.data.status === 'SUCCESS') status = 'SUCCESS';
        return Promise.resolve({ id: 'attempt-concurrent', ...args.data });
      });

      const [res1, res2] = await Promise.all([
        service.processCashfreeWebhook(rawSuccessWebhook, validHeaders),
        service.processCashfreeWebhook(rawSuccessWebhook, validHeaders),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      // Accounting ledger payment must be recorded exactly once
      expect(mockBillingService.recordPayment).toHaveBeenCalledTimes(1);
    });

    it('mismatched currency between gateway verification and INR rejected', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        gatewayOrderId: 'cf_INV-2026-001_100',
        amount: 5000,
        invoiceId: 'inv-201',
      });
      mockCashfreeGateway.fetchPaymentStatus.mockResolvedValue({
        status: 'SUCCESS',
        paymentId: '88776655',
        amount: 5000,
        currency: 'USD',
      });

      const res = await service.processCashfreeWebhook(
        rawSuccessWebhook,
        validHeaders,
      );
      expect(res).toEqual({ success: false, message: 'Currency mismatch' });
      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
    });

    it('idempotency: duplicate webhook when PaymentAttempt is already SUCCESS acknowledged without duplicate payment', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-already-success',
        gatewayOrderId: 'cf_INV-2026-001_100',
        status: 'SUCCESS',
        amount: 5000,
        invoiceId: 'inv-201',
      });
      mockCashfreeGateway.fetchPaymentStatus.mockResolvedValue({
        status: 'SUCCESS',
        paymentId: '88776655',
        amount: 5000,
        currency: 'INR',
      });

      const res = await service.processCashfreeWebhook(
        rawSuccessWebhook,
        validHeaders,
      );
      expect(res).toEqual({
        success: true,
        message: 'Payment attempt already reconciled',
      });
      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
    });

    it('idempotency: duplicate Cashfree paymentId already in Payment ledger acknowledged without duplicate recordPayment', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-pending',
        gatewayOrderId: 'cf_INV-2026-001_100',
        status: 'PENDING',
        amount: 5000,
        invoiceId: 'inv-201',
      });
      mockCashfreeGateway.fetchPaymentStatus.mockResolvedValue({
        status: 'SUCCESS',
        paymentId: '88776655',
        amount: 5000,
        currency: 'INR',
      });
      // Existing payment with transactionId in DB
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'payment-existing',
        transactionId: '88776655',
      });

      const res = await service.processCashfreeWebhook(
        rawSuccessWebhook,
        validHeaders,
      );
      expect(res).toEqual({
        success: true,
        message: 'Payment already recorded in accounting ledger',
      });
      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
      expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith({
        where: { id: 'attempt-pending' },
        data: { status: 'SUCCESS', gatewayPaymentId: '88776655' },
      });
    });
  });

  // =========================================================================
  // 3. ACCOUNTING & ASSET RENEWAL CONVERGENCE
  // =========================================================================
  describe('Accounting Convergence & Asset Renewal', () => {
    const rawSuccessWebhook = JSON.stringify({
      data: {
        order: { order_id: 'cf_INV-2026-001_100' },
        payment: { cf_payment_id: 88776655, payment_status: 'SUCCESS' },
      },
    });
    const validHeaders = {
      'x-webhook-signature': 'mock_valid_sig',
      'x-webhook-timestamp': '1726750000',
    };

    it('successful Cashfree payment strictly converges into BillingService.recordPayment() and marks PaymentAttempt SUCCESS', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-live',
        gatewayOrderId: 'cf_INV-2026-001_100',
        status: 'PENDING',
        amount: 10000,
        invoiceId: 'inv-201',
      });
      mockCashfreeGateway.fetchPaymentStatus.mockResolvedValue({
        status: 'SUCCESS',
        paymentId: 'CF_PAY_998877',
        amount: 10000,
        currency: 'INR',
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-201',
        status: 'unpaid',
        balanceDue: 10000,
      });

      const res = await service.processCashfreeWebhook(
        rawSuccessWebhook,
        validHeaders,
      );

      expect(res).toEqual({
        success: true,
        message: 'Payment successfully verified and recorded',
      });

      // Check that BillingService.recordPayment was invoked with verified amount and payment ID
      expect(mockBillingService.recordPayment).toHaveBeenCalledWith(
        'inv-201',
        expect.objectContaining({
          amount: 10000,
          method: 'ONLINE_CASHFREE',
          transactionId: 'CF_PAY_998877',
        }),
      );

      // Check that PaymentAttempt was updated to SUCCESS
      expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith({
        where: { id: 'attempt-live' },
        data: expect.objectContaining({
          status: 'SUCCESS',
          gatewayPaymentId: 'CF_PAY_998877',
        }),
      });
    });

    it('prevents overpayment if invoice balance was reduced prior to webhook arrival', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-live-2',
        gatewayOrderId: 'cf_INV-2026-001_100',
        status: 'PENDING',
        amount: 10000,
        invoiceId: 'inv-201',
      });
      mockCashfreeGateway.fetchPaymentStatus.mockResolvedValue({
        status: 'SUCCESS',
        paymentId: 'CF_PAY_PARTIAL',
        amount: 10000,
        currency: 'INR',
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      // Meanwhile, invoice balance was reduced to 4000
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-201',
        status: 'partial_paid',
        balanceDue: 4000,
      });

      await service.processCashfreeWebhook(rawSuccessWebhook, validHeaders);

      // Must record maximum of remaining balanceDue (4000) rather than blindly 10000
      expect(mockBillingService.recordPayment).toHaveBeenCalledWith(
        'inv-201',
        expect.objectContaining({
          amount: 4000,
          method: 'ONLINE_CASHFREE',
          transactionId: 'CF_PAY_PARTIAL',
        }),
      );
    });

    it('reconciles Collects payment attempt without touching BillingService or Invoice table when appId is present', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-collects-1',
        gatewayOrderId: 'cf_ORD_COLLECTS_1',
        status: 'PENDING',
        amount: 2999,
        appId: 'reach_ai',
        externalOrderId: 'reach_sub_101',
        invoiceId: null,
        metadata: { plan: 'PRO' },
      });
      mockCashfreeGateway.fetchPaymentStatus.mockResolvedValue({
        status: 'SUCCESS',
        paymentId: 'CF_PAY_COLLECTS_99',
        amount: 2999,
        currency: 'INR',
      });

      const collectsWebhook = JSON.stringify({
        data: {
          order: { order_id: 'cf_ORD_COLLECTS_1', order_amount: 2999 },
          payment: {
            cf_payment_id: 'CF_PAY_COLLECTS_99',
            payment_status: 'SUCCESS',
          },
        },
      });

      const res = await service.processCashfreeWebhook(
        collectsWebhook,
        validHeaders,
      );

      expect(res.success).toBe(true);
      expect(res.message).toContain('Collects payment successfully verified');
      // Crucial verification: zero calls to billingService or invoices
      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
      expect(mockPrisma.invoice.findUnique).not.toHaveBeenCalled();

      // Check PaymentAttempt marked SUCCESS with Collects metadata
      expect(mockPrisma.paymentAttempt.update).toHaveBeenCalledWith({
        where: { id: 'attempt-collects-1' },
        data: expect.objectContaining({
          status: 'SUCCESS',
          gatewayPaymentId: 'CF_PAY_COLLECTS_99',
          metadata: expect.objectContaining({
            isCollectsReconciled: true,
            verifiedAmount: 2999,
          }),
        }),
      });
    });

    it('resolves account-specific credentialsOverride when paymentAttempt has gatewayAccountId', async () => {
      const mockAccountCreds = {
        appId: 'CF_CUSTOM_APP',
        secretKey: 'custom_secret',
        webhookSecret: 'custom_wh_secret',
        environment: 'production',
      };

      mockPaymentConfigService.resolveGatewayAccount.mockResolvedValue({
        accountId: 'acc-custom-1',
        credentials: mockAccountCreds,
      });

      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-custom-acc',
        gatewayOrderId: 'cf_ORD_CUSTOM_ACC',
        status: 'PENDING',
        amount: 1500,
        appId: 'foxrun',
        invoiceId: null,
        gatewayAccountId: 'acc-custom-1',
        environment: 'production',
      });

      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockCashfreeGateway.fetchPaymentStatus.mockResolvedValue({
        status: 'SUCCESS',
        paymentId: 'CF_PAY_FOX_01',
        amount: 1500,
        currency: 'INR',
      });

      const webhook = JSON.stringify({
        data: {
          order: { order_id: 'cf_ORD_CUSTOM_ACC' },
          payment: {
            cf_payment_id: 'CF_PAY_FOX_01',
            payment_status: 'SUCCESS',
          },
        },
      });

      await service.processCashfreeWebhook(webhook, validHeaders);

      expect(
        mockPaymentConfigService.resolveGatewayAccount,
      ).toHaveBeenCalledWith('CASHFREE', 'production', 'acc-custom-1');
      expect(mockCashfreeGateway.verifyWebhookSignature).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialsOverride: mockAccountCreds,
        }),
      );
      expect(mockCashfreeGateway.fetchPaymentStatus).toHaveBeenCalledWith(
        'cf_ORD_CUSTOM_ACC',
        mockAccountCreds,
      );
    });

    it('rejects webhook when account-specific signature verification fails', async () => {
      mockPaymentConfigService.resolveGatewayAccount.mockResolvedValue({
        accountId: 'acc-custom-1',
        credentials: {
          appId: 'CF_APP',
          secretKey: 'sec',
          webhookSecret: 'wh_secret',
        },
      });

      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-custom-acc',
        gatewayOrderId: 'cf_ORD_FAIL_SIG',
        gatewayAccountId: 'acc-custom-1',
      });

      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(false);

      const webhook = JSON.stringify({
        data: {
          order: { order_id: 'cf_ORD_FAIL_SIG' },
        },
      });

      await expect(
        service.processCashfreeWebhook(webhook, validHeaders),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.paymentAttempt.update).not.toHaveBeenCalled();
    });

    it('out-of-order event protection: delayed FAILED webhook cannot downgrade an already reconciled SUCCESS attempt', async () => {
      mockCashfreeGateway.verifyWebhookSignature.mockResolvedValue(true);
      mockPrisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'attempt-already-success',
        gatewayOrderId: 'cf_ORD_DELAYED',
        status: 'SUCCESS',
        amount: 5000,
      });

      const delayedFailedWebhook = JSON.stringify({
        data: {
          order: { order_id: 'cf_ORD_DELAYED' },
          payment: { cf_payment_id: 9999, payment_status: 'FAILED' },
        },
      });

      const res = await service.processCashfreeWebhook(
        delayedFailedWebhook,
        validHeaders,
      );

      expect(res.success).toBe(true);
      expect(res.message).toBe('Payment attempt already reconciled');
      // Must not update status to FAILED
      expect(mockPrisma.paymentAttempt.update).not.toHaveBeenCalled();
    });
  });
});
