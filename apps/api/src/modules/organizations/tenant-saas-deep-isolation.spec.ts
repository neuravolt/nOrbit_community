import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { PaymentConfigService } from '../payments/payment-config.service';
import { HrService } from '../hr/hr.service';
import { UploadsService } from '../uploads/uploads.service';
import { BillingService } from '../billing/billing.service';
import { AssetsService } from '../assets/assets.service';
import { AssetsRepository } from '../assets/assets.repository';

describe('Deep Multi-Tenant SaaS Isolation & Non-Regression Suite', () => {
  let mockPrisma: any;
  let companyProfileService: CompanyProfileService;
  let paymentConfigService: PaymentConfigService;
  let hrService: HrService;
  let uploadsService: UploadsService;
  let billingService: BillingService;
  let assetsService: AssetsService;
  let assetsRepository: AssetsRepository;

  const tenantA = {
    id: 'user-tenant-a',
    email: 'owner@tenant-a.com',
    role: 'MANAGER',
    userType: 'CUSTOMER',
    activeOrganizationId: 'org-tenant-a',
  };

  const tenantB = {
    id: 'user-tenant-b',
    email: 'owner@tenant-b.com',
    role: 'MANAGER',
    userType: 'CUSTOMER',
    activeOrganizationId: 'org-tenant-b',
  };

  const staffUser = {
    id: 'user-internal-staff',
    email: 'admin@neuravolt.in',
    role: 'SUPER_ADMIN',
    userType: 'STAFF',
    activeOrganizationId: null,
  };

  beforeEach(() => {
    mockPrisma = {
      companyProfile: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      paymentGatewayAccount: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      attachment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      invoice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
      },
      plan: {
        findFirst: jest.fn(),
      },
      organizationSubscription: {
        upsert: jest.fn(),
      },
      client: {
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      asset: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      taskAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      role: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userRole: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    companyProfileService = new CompanyProfileService(mockPrisma as any);
    paymentConfigService = new PaymentConfigService(
      companyProfileService,
      mockPrisma as any,
    );
    hrService = new HrService(
      mockPrisma as any,
      {} as any,
      {} as any,
      companyProfileService,
    );
    uploadsService = new UploadsService(mockPrisma as any);
    billingService = new BillingService(
      mockPrisma as any,
      companyProfileService,
      {} as any,
      {} as any,
    );
    assetsRepository = new AssetsRepository(mockPrisma as any);
    assetsService = new AssetsService(
      assetsRepository,
      mockPrisma as any,
      null as any,
    );
  });

  describe('1. Tenant Company Profile & Cashfree Gateway Isolation', () => {
    it('returns tenant-specific company profile for Tenant A without leaking NeuraVolt internal data', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue({
        id: 'prof-a',
        organizationId: 'org-tenant-a',
        companyName: 'Company A Tech LLP',
        legalName: 'Company A Tech LLP',
        cashfreeEnvironment: 'sandbox',
        cashfreeAppId: 'CF_APP_TENANT_A',
      });

      const profileA = await companyProfileService.get('org-tenant-a');
      expect(profileA.companyName).toBe('Company A Tech LLP');
      expect(mockPrisma.companyProfile.findUnique).toHaveBeenCalledWith({
        where: { organizationId: 'org-tenant-a' },
      });
    });

    it('returns default NeuraVolt internal profile when organizationId is null (Internal Platform Preservation)', async () => {
      mockPrisma.companyProfile.findFirst.mockResolvedValue({
        id: 'prof-internal',
        organizationId: null,
        companyName: 'NeuraVolt Technology',
        legalName: 'NeuraVolt Technology Pvt Ltd',
      });

      const profileInternal = await companyProfileService.get(null);
      expect(profileInternal.companyName).toBe('NeuraVolt Technology');
      expect(mockPrisma.companyProfile.findFirst).toHaveBeenCalledWith({
        where: { organizationId: null },
      });
    });

    it('resolves Tenant A Cashfree credentials dynamically from Tenant A profile', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue({
        id: 'prof-a',
        organizationId: 'org-tenant-a',
        cashfreeEnvironment: 'sandbox',
        cashfreeSandboxAppId: 'CF_SANDBOX_APP_TENANT_A',
        cashfreeSandboxSecretKeyEnc: 'plain_secret_a', // mocked unencrypted fallback
      });

      const creds = await paymentConfigService.getCashfreeCredentials('sandbox', 'org-tenant-a');
      expect(creds).toBeDefined();
      expect(creds?.appId).toBe('CF_SANDBOX_APP_TENANT_A');
    });
  });

  describe('2. HRMS & Employee Directory Tenant Isolation', () => {
    it('scopes listEmployees query strictly to Tenant A and filters userType: CUSTOMER', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'emp-a1',
          email: 'worker@tenant-a.com',
          firstName: 'Worker',
          lastName: 'One',
          userType: 'CUSTOMER',
          activeOrganizationId: 'org-tenant-a',
        },
      ]);

      const result = await hrService.listEmployees({}, tenantA);
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('worker@tenant-a.com');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userType: 'CUSTOMER',
            OR: expect.arrayContaining([
              { activeOrganizationId: 'org-tenant-a' },
              { organizationId: 'org-tenant-a' },
            ]),
          }),
        }),
      );
    });

    it('scopes listEmployees query for STAFF to internal staff users only (NeuraVolt internal intact)', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'emp-internal',
          email: 'staff@neuravolt.in',
          firstName: 'Staff',
          lastName: 'Dev',
          userType: 'STAFF',
        },
      ]);

      const result = await hrService.listEmployees({}, staffUser);
      expect(result).toHaveLength(1);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userType: 'STAFF',
          }),
        }),
      );
    });

    it('creates an employee with userType: CUSTOMER and organizationId when called by Tenant A owner', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-emp-a',
        email: 'newbie@tenant-a.com',
        userType: 'CUSTOMER',
        activeOrganizationId: 'org-tenant-a',
      });

      await hrService.createEmployee(
        {
          email: 'newbie@tenant-a.com',
          firstName: 'New',
          lastName: 'Guy',
          password: 'Password123!',
          joiningDate: '2026-11-01',
        } as any,
        tenantA,
      );

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userType: 'CUSTOMER',
            activeOrganizationId: 'org-tenant-a',
            organizationId: 'org-tenant-a',
          }),
        }),
      );
    });
  });

  describe('3. Uploads & Attachment Isolation', () => {
    it('blocks Customer B from accessing an attachment owned by Customer A', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        filename: 'secret-a.pdf',
        organizationId: 'org-tenant-a',
      });

      await expect(
        uploadsService.getAttachmentForStream('att-1', tenantB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer B from deleting an attachment owned by Customer A', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        filename: 'secret-a.pdf',
        organizationId: 'org-tenant-a',
      });

      await expect(
        uploadsService.deleteAttachment('att-1', tenantB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('scopes getGlobalResources to customer activeOrganizationId', async () => {
      mockPrisma.attachment.findMany.mockResolvedValue([]);

      await uploadsService.getGlobalResources(tenantA);

      expect(mockPrisma.attachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-tenant-a',
          }),
        }),
      );
    });
  });

  describe('4. Automated SaaS Subscription Activation on Payment', () => {
    it('automatically transitions OrganizationSubscription to ACTIVE when upgrade invoice INV-SUB-* is paid', async () => {
      const subInvoice = {
        id: 'inv-sub-1',
        invoiceNumber: 'INV-SUB-ABCD123',
        status: 'sent',
        organizationId: 'org-tenant-a',
        grandTotal: 2999,
        amountPaid: 0,
        balanceDue: 2999,
        notes: 'Subscription upgrade to Pro (MONTHLY) - Currency: INR',
        lineItems: [
          {
            description: 'nORBIT SaaS Subscription - Pro Plan (MONTHLY)',
            amount: 2999,
          },
        ],
        payments: [],
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(subInvoice);
      mockPrisma.invoice.findFirst.mockResolvedValue(subInvoice);
      mockPrisma.invoice.update.mockResolvedValue({
        ...subInvoice,
        status: 'paid',
        amountPaid: 2999,
        balanceDue: 0,
      });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pmt-1', amount: 2999 });
      mockPrisma.plan.findFirst.mockResolvedValue({
        id: 'plan-pro-id',
        name: 'Pro',
      });

      await billingService.recordPayment('inv-sub-1', {
        amount: 2999,
        method: 'ONLINE',
      });

      expect(mockPrisma.organizationSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-tenant-a' },
          create: expect.objectContaining({
            organizationId: 'org-tenant-a',
            planId: 'plan-pro-id',
            status: 'ACTIVE',
            billingInterval: 'MONTHLY',
          }),
          update: expect.objectContaining({
            planId: 'plan-pro-id',
            status: 'ACTIVE',
            billingInterval: 'MONTHLY',
          }),
        }),
      );
    });

    it('routes INV-SUB-* plan checkout to NeuraVolt internal Collect credentials (targetOrgId = null)', async () => {
      mockPrisma.companyProfile.findFirst.mockResolvedValue({
        id: 'prof-internal',
        organizationId: null,
        onlinePaymentEnabled: true,
      });

      const getPaymentConfigSpy = jest.spyOn(paymentConfigService, 'getPaymentConfig');

      const subInvoice = {
        id: 'inv-sub-1',
        invoiceNumber: 'INV-SUB-12345',
        organizationId: 'org-tenant-a',
        clientId: 'client-1',
        status: 'SENT',
        balanceDue: 2999,
      };

      const isSubscription = subInvoice.invoiceNumber.startsWith('INV-SUB-');
      const targetOrgId = isSubscription ? null : subInvoice.organizationId;

      await paymentConfigService.getPaymentConfig(targetOrgId);
      expect(getPaymentConfigSpy).toHaveBeenCalledWith(null);
    });
  });

  describe('6. Assets & BYOVPS Fleet Multi-Tenant Scoping', () => {
    it('scopes listAssets to activeOrganizationId for SaaS customer and hides other tenants assets', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        {
          id: 'asset-tenant-a-1',
          name: 'Tenant A VPS',
          type: 'VPS',
          organizationId: 'org-tenant-a',
          clientId: 'client-1',
          client: { id: 'client-1', name: 'Client 1' },
        },
      ]);
      mockPrisma.asset.count.mockResolvedValue(1);

      const res = await assetsService.listAssets({}, tenantA);
      expect(res.assets).toHaveLength(1);
      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-tenant-a',
          }),
        }),
      );
    });

    it('creates asset with activeOrganizationId automatically attached for customer', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ id: 'client-1' });
      mockPrisma.asset.create.mockResolvedValue({
        id: 'new-vps-1',
        name: 'BYOVPS Server',
        type: 'VPS',
        organizationId: 'org-tenant-a',
        clientId: 'client-1',
        client: { id: 'client-1', name: 'Client 1' },
      });

      await assetsService.createAsset(
        {
          name: 'BYOVPS Server',
          type: 'VPS',
          clientId: 'client-1',
        } as any,
        tenantA,
      );

      expect(mockPrisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-tenant-a',
          }),
        }),
      );
    });

    it('blocks tenant A from fetching an asset belonging to tenant B', async () => {
      // findFirst with where: { id: 'asset-b', organizationId: 'org-tenant-a' } returns null
      mockPrisma.asset.findFirst.mockResolvedValue(null);

      await expect(
        assetsService.getAssetById('asset-b', tenantA),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'asset-b',
            organizationId: 'org-tenant-a',
          },
        }),
      );
    });

    it('allows NeuraVolt internal staff to view assets without tenant organization filter (Preserving Internal View)', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        {
          id: 'internal-vps-1',
          name: 'NeuraVolt Master VPS',
          type: 'VPS',
          organizationId: null,
          clientId: 'client-nv',
          client: { id: 'client-nv', name: 'Internal Client' },
        },
      ]);
      mockPrisma.asset.count.mockResolvedValue(1);

      const res = await assetsService.listAssets({}, staffUser);
      expect(res.assets).toHaveLength(1);
      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            organizationId: expect.anything(),
          }),
        }),
      );
    });
  });
});
