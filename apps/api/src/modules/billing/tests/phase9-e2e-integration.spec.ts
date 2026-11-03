import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { encrypt, getEncryptionKey } from '@neuravolt/shared-utils';
import { PaymentsService } from '../../payments/payments.service';
import { PaymentConfigService } from '../../payments/payment-config.service';
import { CashfreePaymentGateway } from '../../payments/gateways/cashfree.gateway';
import { ManualPaymentsService } from '../manual-payments.service';
import { BillingService } from '../billing.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CompanyProfileService } from '../../company-profile/company-profile.service';
import { CompanyProfileController } from '../../company-profile/company-profile.controller';
import { NotificationsService } from '../../notifications/notifications.service';
import { PdfService } from '../../../common/pdf/pdf.service';

describe('Phase 9 — Final End-to-End Integration & System Verification', () => {
  let paymentsService: PaymentsService;
  let paymentConfigService: PaymentConfigService;
  let manualPaymentsService: ManualPaymentsService;
  let billingService: BillingService;
  let companyProfileService: CompanyProfileService;
  let prisma: any;
  let cashfreeGateway: any;

  const encKey = getEncryptionKey();
  const mockWebhookSecret = 'test_webhook_secret_phase9_key_abc';

  beforeEach(async () => {
    // Clean up environment overrides
    delete process.env.CASHFREE_APP_ID;
    delete process.env.CASHFREE_SECRET_KEY;
    delete process.env.CASHFREE_ENVIRONMENT;
    delete process.env.CASHFREE_WEBHOOK_SECRET;

    prisma = {
      companyProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'comp-1',
          onlinePaymentEnabled: true,
          manualPaymentEnabled: true,
          activeOnlineGateway: 'CASHFREE',
        }),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      asset: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      client: {
        findUnique: jest.fn(),
      },
      paymentAttempt: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      manualPaymentSubmission: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    cashfreeGateway = {
      createOrder: jest.fn(),
      getOrder: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };

    const mockNotificationsService = {
      handleInvoiceSent: jest.fn().mockResolvedValue(true),
      sendEmail: jest.fn().mockResolvedValue(true),
    };

    const mockPdfService = {
      generateInvoicePdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        PaymentConfigService,
        ManualPaymentsService,
        BillingService,
        CompanyProfileService,
        { provide: PrismaService, useValue: prisma },
        { provide: CashfreePaymentGateway, useValue: cashfreeGateway },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: PdfService, useValue: mockPdfService },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
    paymentConfigService =
      module.get<PaymentConfigService>(PaymentConfigService);
    manualPaymentsService = module.get<ManualPaymentsService>(
      ManualPaymentsService,
    );
    billingService = module.get<BillingService>(BillingService);
    companyProfileService = module.get<CompanyProfileService>(
      CompanyProfileService,
    );
  });

  describe('1. Cashfree Online Checkout & Reconciliation Lifecycle E2E', () => {
    it('should complete checkout session creation, webhook verification, and accounting convergence', async () => {
      const encryptedSecret = encrypt('CF_SECRET_456', encKey);
      const encryptedWebhookSecret = encrypt(mockWebhookSecret, encKey);

      prisma.companyProfile.findFirst.mockResolvedValue({
        id: 'comp-1',
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
        cashfreeAppId: 'CF_APP_123',
        cashfreeSecretKeyEnc: encryptedSecret,
        cashfreeWebhookSecretEnc: encryptedWebhookSecret,
        cashfreeEnvironment: 'sandbox',
      });

      const initialRenewalDate = new Date('2026-01-15T00:00:00.000Z');
      const mockAsset = {
        id: 'asset-101',
        name: 'Production Cloud VPS',
        billingCycle: 'ANNUALLY',
        renewalDate: initialRenewalDate,
      };

      const mockInvoice = {
        id: 'inv-101',
        invoiceNumber: 'INV-2026-101',
        clientId: 'client-1',
        assetId: 'asset-101',
        total: 12000,
        grandTotal: 12000,
        amountPaid: 0,
        balanceDue: 12000,
        status: 'sent',
        currency: 'INR',
        client: {
          id: 'client-1',
          name: 'TechCorp Pvt Ltd',
          email: 'finance@techcorp.com',
          phone: '9876543210',
        },
      };

      prisma.invoice.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'inv-101') return Promise.resolve(mockInvoice);
        return Promise.resolve(null);
      });

      prisma.asset.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'asset-101') return Promise.resolve(mockAsset);
        return Promise.resolve(null);
      });

      cashfreeGateway.createOrder.mockResolvedValue({
        cfOrderId: 'cf_ord_9999',
        orderId: 'inv-101_1720000000',
        paymentSessionId: 'session_token_xyz123',
        orderStatus: 'ACTIVE',
      });

      prisma.paymentAttempt.create.mockResolvedValue({
        id: 'att-1',
        invoiceId: 'inv-101',
        gatewayOrderId: 'inv-101_1720000000',
        status: 'INITIATED',
      });

      // 1. Client creates online payment session
      const session = await paymentsService.createOnlinePaymentSession(
        'client-1',
        'inv-101',
      );
      expect(session.paymentSessionId).toBe('session_token_xyz123');
      expect(cashfreeGateway.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 12000,
          currency: 'INR',
        }),
      );

      // 2. Cashfree Webhook callback with HMAC signature
      const rawPayload = JSON.stringify({
        data: {
          order: {
            order_id: 'inv-101_1720000000',
            order_amount: 12000,
            order_currency: 'INR',
          },
          payment: {
            cf_payment_id: 'cf_pay_7777',
            payment_status: 'SUCCESS',
            payment_amount: 12000,
            payment_currency: 'INR',
            payment_time: '2026-09-20T10:00:00Z',
          },
        },
        event_time: '2026-09-20T10:00:00Z',
        type: 'PAYMENT_SUCCESS_WEBHOOK',
      });

      const timestamp = '1720000100';
      const signaturePayload = timestamp + rawPayload;
      const signature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(signaturePayload)
        .digest('base64');

      cashfreeGateway.verifyWebhookSignature.mockReturnValue(true);

      prisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'att-1',
        invoiceId: 'inv-101',
        gatewayOrderId: 'inv-101_1720000000',
        status: 'INITIATED',
        amount: 12000,
      });

      cashfreeGateway.fetchPaymentStatus = jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        amount: 12000,
        currency: 'INR',
        paymentId: 'cf_pay_7777',
      });

      prisma.payment.create.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-101',
        amount: 12000,
        method: 'ONLINE_CASHFREE',
        transactionId: 'cf_pay_7777',
      });

      prisma.invoice.update.mockResolvedValue({
        ...mockInvoice,
        amountPaid: 12000,
        balanceDue: 0,
        status: 'paid',
      });

      prisma.asset.update.mockResolvedValue({
        ...mockAsset,
        renewalDate: new Date('2027-01-15T00:00:00.000Z'),
      });

      const webhookResult = await paymentsService.processCashfreeWebhook(
        rawPayload,
        {
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp,
        },
      );

      expect(webhookResult.success).toBe(true);
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceId: 'inv-101',
            amount: 12000,
            method: 'ONLINE_CASHFREE',
            transactionId: 'cf_pay_7777',
          }),
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-101' },
          data: expect.objectContaining({
            status: 'paid',
            balanceDue: 0,
            amountPaid: 12000,
          }),
        }),
      );
    });

    it('should handle webhook idempotency: duplicate webhook calls do not duplicate payments', async () => {
      prisma.paymentAttempt.findUnique.mockResolvedValue({
        id: 'att-dup',
        invoiceId: 'inv-101',
        gatewayOrderId: 'inv-101_dup',
        status: 'INITIATED',
        amount: 5000,
      });

      cashfreeGateway.fetchPaymentStatus = jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        amount: 5000,
        currency: 'INR',
        paymentId: 'cf_pay_duplicate_check',
      });

      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-existing',
        invoiceId: 'inv-101',
        transactionId: 'cf_pay_duplicate_check',
      });

      cashfreeGateway.verifyWebhookSignature.mockReturnValue(true);

      const payload = JSON.stringify({
        data: {
          order: { order_id: 'inv-101_dup' },
          payment: {
            cf_payment_id: 'cf_pay_duplicate_check',
            payment_status: 'SUCCESS',
            payment_amount: 5000,
          },
        },
      });

      const res = await paymentsService.processCashfreeWebhook(payload, {
        'x-webhook-signature': 'valid-sig',
        'x-webhook-timestamp': '1720000200',
      });
      expect(res.success).toBe(true);
      expect(res.message).toContain('already recorded');
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('2. Client Portal Manual Payment Submission -> Admin Queue -> Approval E2E', () => {
    it('should submit manual payment as PENDING, allow admin review, and update accounting on approval', async () => {
      const mockInvoice = {
        id: 'inv-202',
        invoiceNumber: 'INV-2026-202',
        clientId: 'client-1',
        total: 10000,
        amountPaid: 0,
        balanceDue: 10000,
        status: 'sent',
      };

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const mockProofFile: any = {
        buffer: Buffer.from('fake-payment-screenshot'),
        originalname: 'neft_receipt.png',
        mimetype: 'image/png',
        size: 50000,
      };

      prisma.manualPaymentSubmission.create.mockResolvedValue({
        id: 'sub-202',
        invoiceId: 'inv-202',
        clientId: 'client-1',
        amount: 10000,
        paymentMethod: 'NEFT',
        utrNumber: 'NEFT20260920001',
        paymentDate: new Date('2026-09-20'),
        status: 'PENDING',
        proofFileUrl: 'uploads/proofs/proof-sub-202.png',
      });

      const submission = await manualPaymentsService.submitManualPayment(
        'client-1',
        'inv-202',
        {
          amount: 10000,
          paymentMethod: 'BANK_TRANSFER', // NEFT is a BANK_TRANSFER in the DTO's method enum
          utrNumber: 'NEFT20260920001',
          paymentDate: '2026-09-20',
        },
        mockProofFile,
      );

      expect(submission.status).toBe('PENDING');
      expect(prisma.payment.create).not.toHaveBeenCalled();

      // Admin reviews submission
      prisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-202',
        invoiceId: 'inv-202',
        clientId: 'client-1',
        amount: 10000,
        paymentMethod: 'NEFT',
        utrNumber: 'NEFT20260920001',
        status: 'PENDING',
        invoice: mockInvoice,
        client: { id: 'client-1', name: 'TechCorp' },
      });

      // Admin approves submission -> Atomic CAS
      prisma.manualPaymentSubmission.updateMany.mockResolvedValue({ count: 1 });
      prisma.payment.create.mockResolvedValue({
        id: 'pay-manual-202',
        invoiceId: 'inv-202',
        amount: 10000,
        method: 'BANK_TRANSFER',
        reference: 'NEFT20260920001',
      });
      prisma.invoice.update.mockResolvedValue({
        ...mockInvoice,
        amountPaid: 10000,
        balanceDue: 0,
        status: 'paid',
      });

      const approvalResult = await manualPaymentsService.approveManualPayment(
        'sub-202',
        'admin-user-1',
      );
      expect(approvalResult.success).toBe(true);

      // Verify convergence into BillingService.recordPayment
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceId: 'inv-202',
            amount: 10000,
            transactionId: 'NEFT20260920001',
          }),
        }),
      );
    });

    it('should prevent concurrent approval race conditions via atomic CAS count check', async () => {
      const mockInvoice = {
        id: 'inv-202',
        clientId: 'client-1',
        total: 10000,
        amountPaid: 0,
        balanceDue: 10000,
        status: 'sent',
      };
      prisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-202',
        invoiceId: 'inv-202',
        clientId: 'client-1',
        amount: 10000,
        status: 'PENDING',
        invoice: mockInvoice,
      });
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      // Concurrent request count is 0
      prisma.manualPaymentSubmission.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        manualPaymentsService.approveManualPayment('sub-202', 'admin-user-2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require rejection reason and prevent accounting entries on rejection', async () => {
      prisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-303',
        invoiceId: 'inv-303',
        status: 'PENDING',
      });
      prisma.manualPaymentSubmission.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        manualPaymentsService.rejectManualPayment('sub-303', 'admin-1', ''),
      ).rejects.toThrow(BadRequestException);

      const rejectResult = await manualPaymentsService.rejectManualPayment(
        'sub-303',
        'admin-1',
        'Invalid UTR reference provided.',
      );
      expect(rejectResult.success).toBe(true);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('3. Client Isolation & Cross-Tenant Security Verification', () => {
    it('should reject online payment session if invoice belongs to a different client', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-foreign-1',
        clientId: 'client-owner-999',
        total: 5000,
        amountPaid: 0,
        balanceDue: 5000,
        status: 'sent',
      });

      await expect(
        paymentsService.createOnlinePaymentSession(
          'client-attacker-111',
          'inv-foreign-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject manual payment submission if invoice belongs to a different client', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-foreign-2',
        clientId: 'client-owner-999',
        balanceDue: 5000,
        status: 'sent',
      });

      const mockFile: any = {
        buffer: Buffer.from('proof'),
        originalname: 'receipt.png',
        mimetype: 'image/png',
        size: 1000,
      };

      await expect(
        manualPaymentsService.submitManualPayment(
          'client-attacker-111',
          'inv-foreign-2',
          {
            amount: 5000,
            paymentMethod: 'UPI',
            utrNumber: 'UPI123',
            paymentDate: '2026-09-20',
          },
          mockFile,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject client attempt to access another client payment proof file', async () => {
      prisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-foreign-3',
        clientId: 'client-owner-999',
        proofFileUrl: 'uploads/proofs/client999.png',
      });

      await expect(
        manualPaymentsService.getProofFile('sub-foreign-3', {
          clientId: 'client-attacker-111',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Central Payment Configuration & Gateway Guardrails', () => {
    it('should completely reject any attempt to activate Razorpay', async () => {
      await expect(
        companyProfileService.upsert({
          activeOnlineGateway: 'RAZORPAY',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should safely expose onlinePaymentEnabled = false if Cashfree credentials are not configured', async () => {
      prisma.companyProfile.findFirst.mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
        cashfreeAppId: null,
        cashfreeSecretKeyEnc: null,
      });

      const config = await paymentConfigService.getPaymentConfig();
      expect(config.onlinePaymentEnabled).toBe(false);
      expect(config.manualPaymentEnabled).toBe(true);
      expect(config.activeOnlineGateway).toBe('CASHFREE');
    });

    it('should never expose raw or decrypted secrets when querying company profile for admin', async () => {
      const encryptedSecret = encrypt('MY_ULTRA_SECRET_KEY', encKey);
      prisma.companyProfile.findFirst.mockResolvedValue({
        id: 'prof-1',
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
        cashfreeAppId: 'CF_APP_123',
        cashfreeSecretKeyEnc: encryptedSecret,
        cashfreeWebhookSecretEnc: encrypt('WH_SEC_789', encKey),
        cashfreeEnvironment: 'production',
      });

      const controller = new CompanyProfileController(companyProfileService);
      const profile = await controller.get();
      expect(profile).toBeDefined();
      expect(profile.cashfreeSecretConfigured).toBe(true);
      expect(profile.cashfreeWebhookSecretConfigured).toBe(true);
      // Ensure raw or decrypted secret is never present
      expect(profile.cashfreeSecretKey).toBeUndefined();
      expect(profile.cashfreeSecretKeyEnc).toBeUndefined();
      expect(JSON.stringify(profile)).not.toContain('MY_ULTRA_SECRET_KEY');
    });
  });
});
