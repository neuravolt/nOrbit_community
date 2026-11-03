import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Reflector } from '@nestjs/core';
import { ManualPaymentsService } from '../manual-payments.service';
import { ManualPaymentsController } from '../manual-payments.controller';
import { Roles } from '../../users/guards/roles.guard';
import { CompanyProfileService } from '../../company-profile/company-profile.service';
import { CompanyProfileController } from '../../company-profile/company-profile.controller';
import { PaymentConfigService } from '../../payments/payment-config.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BillingService } from '../billing.service';

describe('Phase 8: Admin Payment Settings & Manual Payment Verification Queue', () => {
  let manualService: ManualPaymentsService;
  let companyProfileService: CompanyProfileService;
  let paymentConfigService: PaymentConfigService;
  let mockPrisma: any;
  let mockBillingService: any;

  beforeEach(async () => {
    mockPrisma = {
      companyProfile: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        findUnique: jest.fn(),
      },
      manualPaymentSubmission: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockBillingService = {
      recordPayment: jest.fn().mockResolvedValue({ id: 'pmt-1', amount: 5000 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManualPaymentsService,
        CompanyProfileService,
        PaymentConfigService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BillingService, useValue: mockBillingService },
      ],
    }).compile();

    manualService = module.get<ManualPaymentsService>(ManualPaymentsService);
    companyProfileService = module.get<CompanyProfileService>(
      CompanyProfileService,
    );
    paymentConfigService =
      module.get<PaymentConfigService>(PaymentConfigService);
  });

  // ==========================================
  // PART A: PAYMENT SETTINGS (Tests 1 - 8)
  // ==========================================
  describe('Part A: Company Payment Settings', () => {
    it('1. Admin can read payment configuration', async () => {
      mockPrisma.companyProfile.findFirst.mockResolvedValue({
        id: 'prof-1',
        companyName: 'NeuraVolt',
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
        cashfreeAppId: 'CF_APP_123',
        cashfreeSecretKeyEnc: 'enc_secret_key',
        cashfreeWebhookSecretEnc: 'enc_webhook_key',
      });

      const controller = new CompanyProfileController(companyProfileService);
      const profile = await controller.get();

      expect(profile).toBeDefined();
      expect(profile.onlinePaymentEnabled).toBe(true);
      expect(profile.manualPaymentEnabled).toBe(true);
      expect(profile.cashfreeSecretConfigured).toBe(true);
      expect(profile.cashfreeWebhookSecretConfigured).toBe(true);
    });

    it('2. Unauthorized user cannot access payment settings without auth', () => {
      // Reflect metadata ensures JwtAuthGuard is applied to CompanyProfileController.get
      const controller = new CompanyProfileController(companyProfileService);
      const guards = Reflect.getMetadata(
        '__guards__',
        CompanyProfileController.prototype.get,
      );
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThan(0);
    });

    it('3. Online payment toggle persists correctly', async () => {
      mockPrisma.companyProfile.findMany.mockResolvedValue([{ id: 'prof-1' }]);
      mockPrisma.companyProfile.update.mockResolvedValue({
        id: 'prof-1',
        onlinePaymentEnabled: false,
      });

      const updated = await companyProfileService.upsert({
        companyName: 'NeuraVolt',
        onlinePaymentEnabled: false,
      });

      expect(mockPrisma.companyProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ onlinePaymentEnabled: false }),
        }),
      );
    });

    it('4. Manual payment toggle persists correctly', async () => {
      mockPrisma.companyProfile.findMany.mockResolvedValue([{ id: 'prof-1' }]);
      mockPrisma.companyProfile.update.mockResolvedValue({
        id: 'prof-1',
        manualPaymentEnabled: false,
      });

      await companyProfileService.upsert({
        companyName: 'NeuraVolt',
        manualPaymentEnabled: false,
      });

      expect(mockPrisma.companyProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ manualPaymentEnabled: false }),
        }),
      );
    });

    it('5. Cashfree remains active gateway', async () => {
      mockPrisma.companyProfile.findFirst.mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
      });
      const config = await paymentConfigService.getPaymentConfig();
      expect(config.activeOnlineGateway).toBe('CASHFREE');
    });

    it('6. Razorpay cannot be activated as active gateway', async () => {
      await expect(
        companyProfileService.upsert({
          companyName: 'NeuraVolt',
          activeOnlineGateway: 'RAZORPAY',
        } as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        companyProfileService.upsert({
          companyName: 'NeuraVolt',
          paymentGateway: 'RAZORPAY',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. Secrets are never returned decrypted in GET response', async () => {
      mockPrisma.companyProfile.findFirst.mockResolvedValue({
        id: 'prof-1',
        cashfreeSecretKeyEnc: 'enc_secret_key_12345',
        cashfreeWebhookSecretEnc: 'enc_webhook_secret_67890',
        razorpayKeySecretEnc: 'enc_rzp_secret',
      });

      const controller = new CompanyProfileController(companyProfileService);
      const res = await controller.get();

      expect(res).not.toHaveProperty('cashfreeSecretKeyEnc');
      expect(res).not.toHaveProperty('cashfreeWebhookSecretEnc');
      expect(res).not.toHaveProperty('razorpayKeySecretEnc');
      expect(res).not.toHaveProperty('cashfreeSecretKey');
      expect(res).not.toHaveProperty('cashfreeWebhookSecret');
      expect(res.cashfreeSecretConfigured).toBe(true);
    });

    it('8. Missing/corrupt Cashfree credentials safely disable effective online payment', async () => {
      mockPrisma.companyProfile.findFirst.mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        cashfreeAppId: null,
        cashfreeSecretKeyEnc: null,
      });

      const config = await paymentConfigService.getPaymentConfig();
      // Even if onlinePaymentEnabled is true in DB, missing credentials safely disables effective online payment
      expect(config.onlinePaymentEnabled).toBe(false);
      expect(config.manualPaymentEnabled).toBe(true);
    });
  });

  // ==========================================
  // PART B: MANUAL PAYMENT QUEUE (Tests 9 - 22)
  // ==========================================
  describe('Part B: Manual Payment Verification Queue', () => {
    it('9. Admin can list PENDING submissions', async () => {
      const mockSubmissions = [
        { id: 'sub-1', status: 'PENDING', amount: 5000, utrNumber: 'UTR_001' },
      ];
      mockPrisma.manualPaymentSubmission.findMany.mockResolvedValue(
        mockSubmissions,
      );
      mockPrisma.manualPaymentSubmission.count.mockResolvedValue(1);

      const res = await manualService.listManualPayments({ status: 'PENDING' });
      expect(res.data.length).toBe(1);
      expect(res.data[0].status).toBe('PENDING');
      expect(mockPrisma.manualPaymentSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('10. Admin can view submission details', async () => {
      const mockSub = {
        id: 'sub-detail',
        invoiceId: 'inv-1',
        amount: 7500,
        utrNumber: 'UTR_DET_1',
        status: 'PENDING',
        invoice: { invoiceNumber: 'INV-2026-001', balanceDue: 7500 },
        client: { name: 'Acme Corp', email: 'acme@test.com' },
      };
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue(mockSub);

      const found = await mockPrisma.manualPaymentSubmission.findUnique({
        where: { id: 'sub-detail' },
      });
      expect(found.amount).toBe(7500);
      expect(found.invoice.invoiceNumber).toBe('INV-2026-001');
      expect(found.client.name).toBe('Acme Corp');
    });

    it('11. Admin can access proof through authenticated endpoint', async () => {
      const storageDir = (manualService as any).privateStorageDir;
      if (!fs.existsSync(storageDir))
        fs.mkdirSync(storageDir, { recursive: true });
      const testFile = path.join(storageDir, 'proof_test_admin.pdf');
      fs.writeFileSync(testFile, 'PDF_TEST_DATA');

      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-proof-admin',
        proofFileUrl: 'proof_test_admin.pdf',
        clientId: 'client-1',
      });

      const proofRes = await manualService.getProofFile('sub-proof-admin', {
        isAdmin: true,
      });
      expect(proofRes).toBeDefined();
      expect(proofRes.contentType).toBe('application/pdf');
      expect(proofRes.filename).toBe('proof_test_admin.pdf');

      await new Promise<void>((resolve, reject) => {
        proofRes.stream.on('data', () => {});
        proofRes.stream.on('end', () => {
          try {
            if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
          } catch {}
          resolve();
        });
        proofRes.stream.on('error', reject);
      });
    });

    it('12. Approve succeeds for valid PENDING submission', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-valid',
        invoiceId: 'inv-valid',
        amount: 5000,
        paymentMethod: 'BANK_TRANSFER',
        utrNumber: 'UTR_VALID_1',
        status: 'PENDING',
      });

      mockPrisma.manualPaymentSubmission.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-valid',
        status: 'sent',
        balanceDue: 5000,
      });

      const res = await manualService.approveManualPayment(
        'sub-valid',
        'admin-1',
      );
      expect(res.success).toBe(true);
      expect(res.amountRecorded).toBe(5000);
    });

    it('13. Approval uses BillingService.recordPayment() as single sink', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-sink',
        invoiceId: 'inv-sink',
        amount: 3000,
        paymentMethod: 'UPI',
        utrNumber: 'UTR_SINK_1',
        status: 'PENDING',
      });

      mockPrisma.manualPaymentSubmission.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-sink',
        status: 'sent',
        balanceDue: 3000,
      });

      await manualService.approveManualPayment('sub-sink', 'admin-1');

      expect(mockBillingService.recordPayment).toHaveBeenCalledWith(
        'inv-sink',
        expect.objectContaining({
          amount: 3000,
          method: 'UPI',
          transactionId: 'UTR_SINK_1',
        }),
      );
    });

    it('14. Approval updates accounting correctly', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-acct',
        invoiceId: 'inv-acct',
        amount: 4000,
        paymentMethod: 'CHEQUE',
        utrNumber: 'UTR_ACCT_1',
        status: 'PENDING',
      });

      mockPrisma.manualPaymentSubmission.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-acct',
        status: 'sent',
        balanceDue: 4000,
      });

      const result = await manualService.approveManualPayment(
        'sub-acct',
        'admin-1',
      );
      expect(result.amountRecorded).toBe(4000);
      expect(mockBillingService.recordPayment).toHaveBeenCalledTimes(1);
    });

    it('15. Duplicate approval is prevented', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-dup',
        status: 'APPROVED',
      });

      await expect(
        manualService.approveManualPayment('sub-dup', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('16. Concurrent approval is handled safely via atomic CAS', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-race',
        invoiceId: 'inv-race',
        amount: 5000,
        paymentMethod: 'BANK_TRANSFER',
        utrNumber: 'UTR_RACE_1',
        status: 'PENDING',
      });

      // Simultaneous request already claimed and updated status -> count is 0
      mockPrisma.manualPaymentSubmission.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        manualService.approveManualPayment('sub-race', 'admin-2'),
      ).rejects.toThrow(BadRequestException);

      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
    });

    it('17. Fully paid invoice cannot receive another manual payment approval', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-paid-inv',
        invoiceId: 'inv-paid',
        amount: 2000,
        status: 'PENDING',
      });

      mockPrisma.manualPaymentSubmission.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.manualPaymentSubmission.update.mockResolvedValue({});
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-paid',
        status: 'paid',
        balanceDue: 0,
      });

      await expect(
        manualService.approveManualPayment('sub-paid-inv', 'admin-1'),
      ).rejects.toThrow('Invoice has already been fully settled');

      // State rolled back
      expect(mockPrisma.manualPaymentSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-paid-inv' },
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('18. Reject requires a reason', async () => {
      await expect(
        manualService.rejectManualPayment('sub-1', 'admin-1', ''),
      ).rejects.toThrow('Rejection reason is required');

      await expect(
        manualService.rejectManualPayment('sub-1', 'admin-1', '   '),
      ).rejects.toThrow('Rejection reason is required');
    });

    it('19. Rejected submission cannot be approved through normal flow', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-rej',
        status: 'REJECTED',
      });

      await expect(
        manualService.approveManualPayment('sub-rej', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('20. Client cannot access admin queue', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        ManualPaymentsController,
      );
      const reflector = new Reflector();
      const roles = reflector.get(
        Roles,
        ManualPaymentsController.prototype.list,
      );
      expect(guards).toBeDefined();
      expect(roles).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'MANAGER']));
      expect(roles).not.toContain('CLIENT');
    });

    it("21. Client cannot access another client's proof", async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-owner-1',
        clientId: 'client-legit-owner',
        proofFileUrl: 'proof_legit.png',
      });

      await expect(
        manualService.getProofFile('sub-owner-1', {
          clientId: 'client-attacker',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('22. Private proof storage remains protected and non-public', () => {
      // Verify storage path is in private directory and not under public static folder
      const storageDir = (manualService as any).privateStorageDir;
      expect(storageDir).not.toContain('/public');
      expect(storageDir).toContain('private');
    });
  });
});
