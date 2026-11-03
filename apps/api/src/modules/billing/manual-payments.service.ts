import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentConfigService } from '../payments/payment-config.service';
import { BillingService } from './billing.service';
import {
  SubmitManualPaymentDto,
  ListManualPaymentsQuery,
  PaymentMethodType,
} from './dto/manual-payment.dto';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

@Injectable()
export class ManualPaymentsService {
  private readonly logger = new Logger(ManualPaymentsService.name);
  private readonly privateStorageDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentConfigService: PaymentConfigService,
    private readonly billingService: BillingService,
  ) {
    this.privateStorageDir = path.resolve(
      process.env.PRIVATE_STORAGE_PATH || './storage/private/payment-proofs',
    );
    // Ensure private storage directory exists
    try {
      if (!fs.existsSync(this.privateStorageDir)) {
        fs.mkdirSync(this.privateStorageDir, { recursive: true });
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to initialize private storage directory: ${err.message}`,
      );
    }
  }

  /**
   * Validates and saves uploaded proof file to private non-public directory.
   */
  private async saveProofFile(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException(
        'Payment proof document/screenshot is required',
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Proof file size must not exceed 10MB');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `File extension ${ext} is not allowed for payment proofs`,
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not an allowed proof format`,
      );
    }

    const secureFilename = `proof_${uuidv4()}${ext}`;
    const targetPath = path.join(this.privateStorageDir, secureFilename);

    if (file.buffer) {
      await fs.promises.writeFile(targetPath, file.buffer);
    } else if (file.path) {
      await fs.promises.copyFile(file.path, targetPath);
    } else {
      throw new BadRequestException('Uploaded file content could not be read');
    }

    return secureFilename;
  }

  /**
   * Client submits a manual payment claim with receipt/proof for verification.
   */
  async submitManualPayment(
    clientId: string,
    invoiceId: string,
    dto: SubmitManualPaymentDto,
    file: Express.Multer.File,
  ) {
    // 1. Authorization & invoice existence check
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.clientId !== clientId) {
      throw new ForbiddenException(
        'Access denied: invoice does not belong to your account',
      );
    }

    // 2. Invoice state checks
    if (invoice.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot submit manual payment for a cancelled invoice',
      );
    }

    if (invoice.status === 'draft') {
      throw new BadRequestException(
        'Invoice is in draft status and not yet payable',
      );
    }

    if (invoice.status === 'paid' || Number(invoice.balanceDue) <= 0) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    // 3. Central configuration authority check
    const config = await this.paymentConfigService.getPaymentConfig();
    if (!config.manualPaymentEnabled) {
      throw new BadRequestException(
        'Manual payment verification is currently disabled',
      );
    }

    // 4. Amount validation
    const submittedAmount = Math.round(Number(dto.amount) * 100) / 100;
    const balanceDue = Number(invoice.balanceDue);

    if (submittedAmount <= 0 || !Number.isFinite(submittedAmount)) {
      throw new BadRequestException(
        'Submitted amount must be a positive number',
      );
    }

    if (submittedAmount > balanceDue) {
      throw new BadRequestException(
        `Submitted amount (₹${submittedAmount}) exceeds remaining balance due (₹${balanceDue})`,
      );
    }

    // 5. Payment date validation
    const paymentDate = new Date(dto.paymentDate);
    if (isNaN(paymentDate.getTime())) {
      throw new BadRequestException('Invalid payment date format');
    }

    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    const oneDayInFuture = now + 24 * 60 * 60 * 1000;

    if (paymentDate.getTime() > oneDayInFuture) {
      throw new BadRequestException('Payment date cannot be in the future');
    }

    if (paymentDate.getTime() < ninetyDaysAgo) {
      throw new BadRequestException(
        'Payment date cannot be older than 90 days',
      );
    }

    // 6. Duplicate UTR check across pending & approved submissions
    const sanitizedUtr = dto.utrNumber.trim();
    const existingUtr = await this.prisma.manualPaymentSubmission.findFirst({
      where: {
        utrNumber: sanitizedUtr,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (existingUtr) {
      throw new BadRequestException(
        `A payment submission with UTR / reference "${sanitizedUtr}" already exists`,
      );
    }

    // 7. Prevent concurrent unresolved submissions for the same invoice
    const pendingSubmission =
      await this.prisma.manualPaymentSubmission.findFirst({
        where: {
          invoiceId,
          status: 'PENDING',
        },
      });

    if (pendingSubmission) {
      throw new BadRequestException(
        'A manual payment submission for this invoice is already awaiting admin verification',
      );
    }

    // 8. Secure proof file storage
    const secureFilename = await this.saveProofFile(file);

    // 9. Create submission record in PENDING state
    const submission = await this.prisma.manualPaymentSubmission.create({
      data: {
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        amount: submittedAmount,
        paymentMethod: dto.paymentMethod,
        utrNumber: sanitizedUtr,
        paymentDate,
        proofFileUrl: secureFilename,
        notes: dto.notes?.trim() || null,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `Manual payment submitted: submissionId=${submission.id}, invoiceId=${invoice.id}, amount=${submittedAmount}, method=${dto.paymentMethod}, utr=${sanitizedUtr}`,
    );

    return {
      submissionId: submission.id,
      status: 'PENDING',
      amount: submission.amount,
      paymentMethod: submission.paymentMethod as PaymentMethodType,
      paymentDate: submission.paymentDate,
      message:
        'Payment submitted successfully and is awaiting admin verification.',
    };
  }

  /**
   * Public submission of manual payment claims from unauthenticated hosted pay page.
   */
  async submitPublicManualPayment(
    invoiceId: string,
    dto: SubmitManualPaymentDto,
    file?: Express.Multer.File,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return this.submitManualPayment(
      invoice.clientId,
      invoiceId,
      dto,
      file as any,
    );
  }

  /**
   * Admin lists manual payment submissions with filters.
   */
  async listManualPayments(query: ListManualPaymentsQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

    const [total, submissions] = await Promise.all([
      this.prisma.manualPaymentSubmission.count({ where }),
      this.prisma.manualPaymentSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              grandTotal: true,
              amountPaid: true,
              balanceDue: true,
              status: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      data: submissions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin approves a manual payment:
   * 1. Validates submission exists and is PENDING.
   * 2. Atomic Compare-And-Swap: transitions status from PENDING -> APPROVED.
   *    If another admin approved concurrently, count is 0 and throws.
   * 3. Re-checks fresh invoice state (balance, status).
   * 4. Converges strictly into BillingService.recordPayment().
   * 5. If recording fails, rolls back submission status to PENDING.
   */
  async approveManualPayment(submissionId: string, adminUserId: string) {
    const submission = await this.prisma.manualPaymentSubmission.findUnique({
      where: { id: submissionId },
      include: { invoice: true },
    });

    if (!submission) {
      throw new NotFoundException('Manual payment submission not found');
    }

    if (submission.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot approve submission: current status is ${submission.status}`,
      );
    }

    // Atomic CAS to claim and lock approval transition
    const casResult = await this.prisma.manualPaymentSubmission.updateMany({
      where: {
        id: submissionId,
        status: 'PENDING',
      },
      data: {
        status: 'APPROVED',
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
    });

    if (casResult.count === 0) {
      throw new BadRequestException(
        'Cannot approve submission: submission is no longer PENDING',
      );
    }

    try {
      // Re-query fresh invoice state
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: submission.invoiceId },
      });

      if (!invoice || invoice.status === 'cancelled') {
        throw new BadRequestException('Invoice is cancelled or missing');
      }

      if (invoice.status === 'paid' || Number(invoice.balanceDue) <= 0) {
        throw new BadRequestException('Invoice has already been fully settled');
      }

      // Capped amount protection against overpayment
      const payableAmount = Math.min(
        submission.amount,
        Number(invoice.balanceDue),
      );

      // Converge into BillingService.recordPayment (Single Accounting Sink)
      await this.billingService.recordPayment(invoice.id, {
        amount: payableAmount,
        method: submission.paymentMethod,
        transactionId: submission.utrNumber,
        notes: `Verified Manual Payment (${submission.paymentMethod}, UTR: ${submission.utrNumber})`,
        receiptUrl: `/billing/manual-payments/${submission.id}/proof`,
      });

      this.logger.log(
        `Approved manual payment: submissionId=${submission.id}, invoiceId=${invoice.id}, amountRecorded=${payableAmount}, reviewedBy=${adminUserId}`,
      );

      return {
        success: true,
        message: 'Manual payment approved and recorded in accounting ledger',
        submissionId: submission.id,
        amountRecorded: payableAmount,
      };
    } catch (err) {
      // Rollback submission state if accounting or validation threw
      await this.prisma.manualPaymentSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'PENDING',
          reviewedById: null,
          reviewedAt: null,
        },
      });
      throw err;
    }
  }

  /**
   * Admin rejects a manual payment submission with atomic CAS and reason requirement.
   */
  async rejectManualPayment(
    submissionId: string,
    adminUserId: string,
    rejectionReason: string,
  ) {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    const submission = await this.prisma.manualPaymentSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Manual payment submission not found');
    }

    if (submission.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot reject submission: current status is ${submission.status}`,
      );
    }

    const casResult = await this.prisma.manualPaymentSubmission.updateMany({
      where: {
        id: submissionId,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        reviewedById: adminUserId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason.trim(),
      },
    });

    if (casResult.count === 0) {
      throw new BadRequestException(
        'Cannot reject submission: submission is no longer PENDING',
      );
    }

    this.logger.log(
      `Rejected manual payment: submissionId=${submission.id}, invoiceId=${submission.invoiceId}, reviewedBy=${adminUserId}, reason=${rejectionReason}`,
    );

    return {
      success: true,
      message: 'Manual payment submission rejected',
      submissionId: submission.id,
    };
  }

  /**
   * Authenticated secure proof download/viewing with authorization check.
   */
  async getProofFile(
    submissionId: string,
    authContext: { clientId?: string; isAdmin?: boolean },
  ) {
    const submission = await this.prisma.manualPaymentSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Client authorization check
    if (authContext.clientId && submission.clientId !== authContext.clientId) {
      throw new ForbiddenException(
        'Access denied: not authorized to view this proof document',
      );
    }

    // Admin authorization check
    if (!authContext.clientId && !authContext.isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    const filePath = path.join(this.privateStorageDir, submission.proofFileUrl);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Proof file not found on disk');
    }

    const ext = path.extname(submission.proofFileUrl).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';

    const fileStream = fs.createReadStream(filePath);
    return {
      stream: fileStream,
      filename: submission.proofFileUrl,
      contentType,
    };
  }

  /**
   * Client lists their submissions for a specific invoice.
   */
  async getInvoiceSubmissionsForClient(clientId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice || invoice.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.manualPaymentSubmission.findMany({
      where: { invoiceId, clientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        utrNumber: true,
        paymentDate: true,
        status: true,
        notes: true,
        rejectionReason: true,
        createdAt: true,
      },
    });
  }
}
