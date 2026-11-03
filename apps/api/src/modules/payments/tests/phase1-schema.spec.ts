import { PrismaClient } from '@prisma/client';

describe('Phase 1: Database Models & Migration Verification', () => {
  let prisma: PrismaClient;
  let testClientId: string;
  let testInvoiceId: string;
  let testUserId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    // Fetch or create a test client
    const existingClient = await prisma.client.findFirst();
    if (existingClient) {
      testClientId = existingClient.id;
    } else {
      const client = await prisma.client.create({
        data: {
          name: 'Test Client Phase 1',
          email: `phase1-test-${Date.now()}@example.com`,
          status: 'ACTIVE',
        },
      });
      testClientId = client.id;
    }

    // Fetch or create a test user
    const existingUser = await prisma.user.findFirst();
    if (existingUser) {
      testUserId = existingUser.id;
    } else {
      const user = await prisma.user.create({
        data: {
          email: `phase1-user-${Date.now()}@example.com`,
          firstName: 'Test',
          lastName: 'Admin Phase 1',
          passwordHash: 'dummyhash',
          role: 'SUPER_ADMIN',
        },
      });
      testUserId = user.id;
    }

    // Fetch or create a test invoice
    const existingInvoice = await prisma.invoice.findFirst({
      where: { clientId: testClientId },
    });
    if (existingInvoice) {
      testInvoiceId = existingInvoice.id;
    } else {
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: `TEST-INV-${Date.now()}`,
          clientId: testClientId,
          status: 'draft',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 7 * 86400000),
          subTotal: 1000,
          grandTotal: 1180,
          balanceDue: 1180,
        },
      });
      testInvoiceId = invoice.id;
    }
  });

  afterAll(async () => {
    // Clean up created payment attempts and manual submissions for the test invoice
    if (testInvoiceId) {
      await (prisma as any).paymentAttempt.deleteMany({
        where: { invoiceId: testInvoiceId },
      });
      await (prisma as any).manualPaymentSubmission.deleteMany({
        where: { invoiceId: testInvoiceId },
      });
    }
    await prisma.$disconnect();
  });

  it('CompanyProfile should contain central payment configuration fields with correct defaults', async () => {
    let profile = await prisma.companyProfile.findFirst();
    if (!profile) {
      profile = await prisma.companyProfile.create({
        data: {
          companyName: 'NeuraVolt Test',
          address: 'Tech Hub',
          city: 'Bhopal',
          state: 'MP',
          zip: '462001',
          phone: '+919999999999',
          email: 'finance@neuravolt.com',
        },
      });
    }

    expect(profile).toBeDefined();
    expect((profile as any).onlinePaymentEnabled).toBe(true);
    expect((profile as any).manualPaymentEnabled).toBe(true);
    expect((profile as any).activeOnlineGateway).toBe('CASHFREE');
    expect((profile as any).cashfreeEnvironment).toBe('sandbox');
  });

  it('PaymentAttempt should create, record gateway interaction, and enforce unique gatewayOrderId', async () => {
    const uniqueOrderId = `CF-TEST-${Date.now()}`;
    const attempt = await (prisma as any).paymentAttempt.create({
      data: {
        invoiceId: testInvoiceId,
        clientId: testClientId,
        gateway: 'CASHFREE',
        gatewayOrderId: uniqueOrderId,
        amount: 1180,
        currency: 'INR',
        status: 'CREATED',
        paymentSessionId: `session_${Date.now()}`,
      },
    });

    expect(attempt).toBeDefined();
    expect(attempt.gatewayOrderId).toBe(uniqueOrderId);
    expect(attempt.status).toBe('CREATED');
    expect(attempt.amount).toBe(1180);

    // Test unique constraint on gatewayOrderId
    await expect(
      (prisma as any).paymentAttempt.create({
        data: {
          invoiceId: testInvoiceId,
          clientId: testClientId,
          gateway: 'CASHFREE',
          gatewayOrderId: uniqueOrderId,
          amount: 1180,
        },
      }),
    ).rejects.toThrow();
  });

  it('ManualPaymentSubmission should create in PENDING state with UTR and proof file', async () => {
    const testUtr = `UTR-TEST-${Date.now()}`;
    const submission = await (prisma as any).manualPaymentSubmission.create({
      data: {
        invoiceId: testInvoiceId,
        clientId: testClientId,
        amount: 500,
        paymentMethod: 'UPI',
        utrNumber: testUtr,
        paymentDate: new Date(),
        proofFileUrl: '/uploads/manual-payments/test-proof.png',
        notes: 'Submitted via GPay',
        status: 'PENDING',
      },
    });

    expect(submission).toBeDefined();
    expect(submission.status).toBe('PENDING');
    expect(submission.utrNumber).toBe(testUtr);
    expect(submission.amount).toBe(500);
    expect(submission.paymentMethod).toBe('UPI');

    // Verify query by status and invoice
    const pendingSubmissions = await (
      prisma as any
    ).manualPaymentSubmission.findMany({
      where: {
        invoiceId: testInvoiceId,
        status: 'PENDING',
      },
    });
    expect(pendingSubmissions.length).toBeGreaterThanOrEqual(1);

    // Test transition to APPROVED by reviewer
    const updated = await (prisma as any).manualPaymentSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'APPROVED',
        reviewedById: testUserId,
        reviewedAt: new Date(),
      },
      include: { reviewedBy: true },
    });

    expect(updated.status).toBe('APPROVED');
    expect(updated.reviewedBy?.id).toBe(testUserId);
  });

  it('Existing Payment and Invoice tables should remain intact and queryable without regressions', async () => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: testInvoiceId },
      include: {
        client: true,
        paymentAttempts: true,
        manualPaymentSubmissions: true,
        payments: true,
      },
    });

    expect(invoice).toBeDefined();
    expect(invoice?.id).toBe(testInvoiceId);
    expect(Array.isArray((invoice as any).paymentAttempts)).toBe(true);
    expect(Array.isArray((invoice as any).manualPaymentSubmissions)).toBe(true);
  });
});
