import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ManualPaymentsService } from '../manual-payments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PaymentConfigService } from '../../payments/payment-config.service';
import { BillingService } from '../billing.service';

describe('Phase 5: ManualPaymentsService Unit & Security Tests', () => {
  let service: ManualPaymentsService;
  let mockPrisma: any;
  let mockPaymentConfigService: any;
  let mockBillingService: any;

  const mockFile: Express.Multer.File = {
    fieldname: 'proof',
    originalname: 'transfer_receipt.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 2048,
    buffer: Buffer.from('fake_image_bytes'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  const mockInvoice = {
    id: 'inv-manual-1',
    clientId: 'client-manual-1',
    invoiceNumber: 'INV-2026-MANUAL',
    status: 'unpaid',
    grandTotal: 15000,
    amountPaid: 0,
    balanceDue: 15000,
  };

  beforeEach(async () => {
    mockPrisma = {
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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockPaymentConfigService = {
      getPaymentConfig: jest.fn().mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: true,
        activeOnlineGateway: 'CASHFREE',
      }),
    };

    mockBillingService = {
      recordPayment: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManualPaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentConfigService, useValue: mockPaymentConfigService },
        { provide: BillingService, useValue: mockBillingService },
      ],
    }).compile();

    service = module.get<ManualPaymentsService>(ManualPaymentsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Client Submission & Authorization', () => {
    it('should submit manual payment successfully for valid client and invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.manualPaymentSubmission.findFirst.mockResolvedValue(null);
      mockPrisma.manualPaymentSubmission.create.mockImplementation(
        (args: any) => ({
          id: 'sub-100',
          ...args.data,
        }),
      );

      const res = await service.submitManualPayment(
        'client-manual-1',
        'inv-manual-1',
        {
          amount: 5000,
          paymentMethod: 'BANK_TRANSFER',
          utrNumber: 'HDFC1234567890',
          paymentDate: new Date().toISOString(),
          notes: 'Paid via IMPS',
        },
        mockFile,
      );

      expect(res.submissionId).toBe('sub-100');
      expect(res.status).toBe('PENDING');
      expect(res.amount).toBe(5000);
      expect(res.paymentMethod).toBe('BANK_TRANSFER');
      expect(res.message).toContain('awaiting admin verification');
      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
    });

    it('should reject with ForbiddenException when client attempts IDOR on another client invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(
        service.submitManualPayment(
          'different-client-attacker',
          'inv-manual-1',
          {
            amount: 5000,
            paymentMethod: 'UPI',
            utrNumber: 'UPI987654321',
            paymentDate: new Date().toISOString(),
          },
          mockFile,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject with NotFoundException when invoice does not exist', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'non-existent-inv',
          {
            amount: 5000,
            paymentMethod: 'UPI',
            utrNumber: 'UPI987654321',
            paymentDate: new Date().toISOString(),
          },
          mockFile,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Invoice State & Configuration Checks', () => {
    it('should reject submission if invoice is cancelled', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'cancelled',
      });

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: 1000,
            paymentMethod: 'CASH',
            utrNumber: 'CASH001',
            paymentDate: new Date().toISOString(),
          },
          mockFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject submission if invoice is in draft status', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'draft',
      });

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: 1000,
            paymentMethod: 'UPI',
            utrNumber: 'UPI001',
            paymentDate: new Date().toISOString(),
          },
          mockFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject submission if invoice is already fully paid', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'paid',
        balanceDue: 0,
      });

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: 1000,
            paymentMethod: 'UPI',
            utrNumber: 'UPI001',
            paymentDate: new Date().toISOString(),
          },
          mockFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject submission if manual payments are disabled in PaymentConfigService', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPaymentConfigService.getPaymentConfig.mockResolvedValue({
        onlinePaymentEnabled: true,
        manualPaymentEnabled: false,
        activeOnlineGateway: 'CASHFREE',
      });

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: 1000,
            paymentMethod: 'UPI',
            utrNumber: 'UPI001',
            paymentDate: new Date().toISOString(),
          },
          mockFile,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Manual payment verification is currently disabled',
        ),
      );
    });
  });

  describe('Amount & UTR Validation', () => {
    it('should reject non-positive amounts', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: 0,
            paymentMethod: 'UPI',
            utrNumber: 'UPI001',
            paymentDate: new Date().toISOString(),
          },
          mockFile,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: -100,
            paymentMethod: 'UPI',
            utrNumber: 'UPI001',
            paymentDate: new Date().toISOString(),
          },
          mockFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject amounts exceeding the current invoice balance due', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        balanceDue: 5000,
      });

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: 5001,
            paymentMethod: 'UPI',
            utrNumber: 'UPI001',
            paymentDate: new Date().toISOString(),
          },
          mockFile,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Submitted amount (₹5001) exceeds remaining balance due (₹5000)',
        ),
      );
    });

    it('should reject duplicate UTR / reference number', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.manualPaymentSubmission.findFirst.mockResolvedValue({
        id: 'existing-sub',
        utrNumber: 'DUPLICATE_UTR_123',
      });

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: 2000,
            paymentMethod: 'BANK_TRANSFER',
            utrNumber: 'DUPLICATE_UTR_123',
            paymentDate: new Date().toISOString(),
          },
          mockFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject submission if another submission for same invoice is already PENDING', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      // UTR is unique, but invoice already has pending submission
      mockPrisma.manualPaymentSubmission.findFirst
        .mockResolvedValueOnce(null) // UTR check passes
        .mockResolvedValueOnce({ id: 'pending-sub-1', status: 'PENDING' }); // invoice pending check fails

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: 2000,
            paymentMethod: 'BANK_TRANSFER',
            utrNumber: 'FRESH_UTR_456',
            paymentDate: new Date().toISOString(),
          },
          mockFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Proof File Security', () => {
    it('should reject missing proof file', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: 2000,
            paymentMethod: 'BANK_TRANSFER',
            utrNumber: 'UTR_NO_FILE',
            paymentDate: new Date().toISOString(),
          },
          null as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid file extensions like .exe or .sh', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.manualPaymentSubmission.findFirst.mockResolvedValue(null);

      const maliciousFile = {
        ...mockFile,
        originalname: 'exploit.sh',
        mimetype: 'application/x-sh',
      };

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: 2000,
            paymentMethod: 'UPI',
            utrNumber: 'UTR_EXEC',
            paymentDate: new Date().toISOString(),
          },
          maliciousFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files exceeding 10MB limit', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.manualPaymentSubmission.findFirst.mockResolvedValue(null);

      const oversizedFile = {
        ...mockFile,
        size: 11 * 1024 * 1024,
      };

      await expect(
        service.submitManualPayment(
          'client-manual-1',
          'inv-manual-1',
          {
            amount: 2000,
            paymentMethod: 'UPI',
            utrNumber: 'UTR_BIG',
            paymentDate: new Date().toISOString(),
          },
          oversizedFile,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Admin Approval & Accounting Convergence', () => {
    it('approving a PENDING submission calls BillingService.recordPayment() and marks APPROVED', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-app-1',
        invoiceId: 'inv-manual-1',
        clientId: 'client-manual-1',
        amount: 5000,
        paymentMethod: 'BANK_TRANSFER',
        utrNumber: 'UTR_APPROVED_1',
        status: 'PENDING',
      });

      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-manual-1',
        status: 'unpaid',
        balanceDue: 15000,
      });

      mockPrisma.manualPaymentSubmission.update.mockResolvedValue({
        id: 'sub-app-1',
        status: 'APPROVED',
      });

      const res = await service.approveManualPayment(
        'sub-app-1',
        'admin-user-77',
      );

      expect(res.success).toBe(true);
      expect(res.amountRecorded).toBe(5000);

      // Verify single accounting sink called
      expect(mockBillingService.recordPayment).toHaveBeenCalledWith(
        'inv-manual-1',
        expect.objectContaining({
          amount: 5000,
          method: 'BANK_TRANSFER',
          transactionId: 'UTR_APPROVED_1',
          receiptUrl: '/billing/manual-payments/sub-app-1/proof',
        }),
      );

      // Verify submission marked APPROVED with reviewer details
      expect(
        mockPrisma.manualPaymentSubmission.updateMany,
      ).toHaveBeenCalledWith({
        where: { id: 'sub-app-1', status: 'PENDING' },
        data: expect.objectContaining({
          status: 'APPROVED',
          reviewedById: 'admin-user-77',
        }),
      });
    });

    it('cannot approve an already APPROVED or REJECTED submission', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-already-app',
        status: 'APPROVED',
      });

      await expect(
        service.approveManualPayment('sub-already-app', 'admin-user-77'),
      ).rejects.toThrow(BadRequestException);
    });

    it('caps approval amount to remaining balance if balance changed before approval', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-cap-1',
        invoiceId: 'inv-manual-1',
        amount: 8000,
        paymentMethod: 'UPI',
        utrNumber: 'UTR_CAPPED_1',
        status: 'PENDING',
      });

      // Invoice balance was reduced to 3000 in the meantime
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-manual-1',
        status: 'partial_paid',
        balanceDue: 3000,
      });

      mockPrisma.manualPaymentSubmission.update.mockResolvedValue({
        id: 'sub-cap-1',
        status: 'APPROVED',
      });

      const res = await service.approveManualPayment(
        'sub-cap-1',
        'admin-user-77',
      );

      expect(res.amountRecorded).toBe(3000);
      expect(mockBillingService.recordPayment).toHaveBeenCalledWith(
        'inv-manual-1',
        expect.objectContaining({
          amount: 3000,
        }),
      );
    });
  });

  describe('Admin Rejection', () => {
    it('rejecting a PENDING submission marks REJECTED with reason and NEVER calls recordPayment', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-rej-1',
        invoiceId: 'inv-manual-1',
        status: 'PENDING',
      });

      mockPrisma.manualPaymentSubmission.update.mockResolvedValue({
        id: 'sub-rej-1',
        status: 'REJECTED',
      });

      const res = await service.rejectManualPayment(
        'sub-rej-1',
        'admin-user-77',
        'UTR not found in bank statement',
      );

      expect(res.success).toBe(true);
      expect(
        mockPrisma.manualPaymentSubmission.updateMany,
      ).toHaveBeenCalledWith({
        where: { id: 'sub-rej-1', status: 'PENDING' },
        data: expect.objectContaining({
          status: 'REJECTED',
          reviewedById: 'admin-user-77',
          rejectionReason: 'UTR not found in bank statement',
        }),
      });

      expect(mockBillingService.recordPayment).not.toHaveBeenCalled();
    });

    it('cannot reject an already REJECTED or APPROVED submission', async () => {
      mockPrisma.manualPaymentSubmission.findUnique.mockResolvedValue({
        id: 'sub-rej-done',
        status: 'REJECTED',
      });

      await expect(
        service.rejectManualPayment('sub-rej-done', 'admin-user-77', 'Reason'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
