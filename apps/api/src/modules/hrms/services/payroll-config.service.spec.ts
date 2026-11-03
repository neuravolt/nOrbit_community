import { BadRequestException } from '@nestjs/common';
import { PayrollConfigService } from './payroll-config.service';

// Enterprise Payroll Engine plan, Slice 1. Covers the two properties the plan's
// own risk review called out explicitly: config changes are always versioned
// (never overwritten in place) and always require a reason, with one audit-log
// row per changed field.
describe('PayrollConfigService', () => {
  let prismaMock: any;
  let service: PayrollConfigService;

  const ORG_ID = 'org-1';

  beforeEach(() => {
    prismaMock = {
      organizationSettings: { findUnique: jest.fn() },
      payrollConfigVersion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      payrollConfigAuditLog: { createMany: jest.fn() },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          payrollConfigVersion: prismaMock.payrollConfigVersion,
          payrollConfigAuditLog: prismaMock.payrollConfigAuditLog,
        }),
      ),
    };
    service = new PayrollConfigService(prismaMock);
  });

  describe('getCurrentVersion / bootstrap', () => {
    it('returns the active version when one already exists, without touching legacy settings', async () => {
      const active = {
        id: 'v2',
        organizationId: ORG_ID,
        version: 2,
        isActive: true,
      };
      prismaMock.payrollConfigVersion.findFirst.mockResolvedValue(active);

      const result = await service.getCurrentVersion(ORG_ID);

      expect(result).toBe(active);
      expect(prismaMock.organizationSettings.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.payrollConfigVersion.create).not.toHaveBeenCalled();
    });

    it('bootstraps version 1 from legacy OrganizationSettings when no version exists yet', async () => {
      prismaMock.payrollConfigVersion.findFirst.mockResolvedValue(null);
      prismaMock.organizationSettings.findUnique.mockResolvedValue({
        pfEmployeeRate: 0.1,
        pfEmployerRate: 0.1,
        pfWageCeiling: 15000,
        pfApplyWageCap: true,
        pfEnabled: true,
        highPackageBasicThreshold: 999999,
        highPackagePfOptional: false,
        esiEmployeeRate: 0.0075,
        esiEmployerRate: 0.0325,
        esiGrossCeiling: 21000,
        esiEnabled: true,
        ptState: 'Maharashtra',
        ptSlabsJson: '[]',
        ptEnabled: true,
        lwpCalculationBase: 'CALENDAR',
        defaultConveyanceEmployee: 1600,
        defaultConveyanceIntern: 0,
        defaultConveyanceContract: 0,
        defaultTaxRegime: 'NEW',
        employmentTypeDefaultsJson: '{}',
      });
      prismaMock.payrollConfigVersion.create.mockImplementation(
        ({ data }: any) => ({ id: 'v1', ...data }),
      );

      const result = await service.getCurrentVersion(ORG_ID, 'user-1');

      expect(result.version).toBe(1);
      expect(result.pfEmployeeRate).toBe(0.1); // pulled from legacy settings, not the hardcoded 0.12 default
      expect(result.ptState).toBe('Maharashtra');
      expect(result.changeReason).toMatch(/Bootstrapped from legacy/);
    });

    it('bootstraps version 1 from hardcoded defaults when no legacy settings row exists either', async () => {
      prismaMock.payrollConfigVersion.findFirst.mockResolvedValue(null);
      prismaMock.organizationSettings.findUnique.mockResolvedValue(null);
      prismaMock.payrollConfigVersion.create.mockImplementation(
        ({ data }: any) => ({ id: 'v1', ...data }),
      );

      const result = await service.getCurrentVersion(ORG_ID, 'user-1');

      expect(result.pfEmployeeRate).toBe(0.12);
      expect(result.ptState).toBe('Karnataka');
      expect(result.changeReason).toMatch(/Initial default configuration/);
    });
  });

  describe('createNewVersion', () => {
    const CURRENT = {
      id: 'v1',
      organizationId: ORG_ID,
      version: 1,
      isActive: true,
      pfEnabled: true,
      pfEmployeeRate: 0.12,
      pfEmployerRate: 0.12,
      pfWageCeiling: 15000,
      pfApplyWageCap: true,
      highPackageBasicThreshold: 999999,
      highPackagePfOptional: false,
      esiEnabled: true,
      esiEmployeeRate: 0.0075,
      esiEmployerRate: 0.0325,
      esiGrossCeiling: 21000,
      ptEnabled: true,
      ptState: 'Karnataka',
      ptSlabsJson: '[]',
      lwpCalculationBase: 'CALENDAR',
      defaultConveyanceEmployee: 1600,
      defaultConveyanceIntern: 0,
      defaultConveyanceContract: 0,
      defaultTaxRegime: 'NEW',
      employmentTypeDefaultsJson: '{}',
    };

    beforeEach(() => {
      prismaMock.payrollConfigVersion.findFirst.mockResolvedValue(CURRENT);
      prismaMock.payrollConfigVersion.create.mockImplementation(
        ({ data }: any) => ({ id: 'v2', ...data }),
      );
    });

    it('rejects an update with no reason', async () => {
      await expect(
        service.createNewVersion(ORG_ID, { pfEmployeeRate: 0.1 }, 'user-1', ''),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.payrollConfigVersion.create).not.toHaveBeenCalled();
    });

    it('rejects an update where nothing actually changed', async () => {
      await expect(
        service.createNewVersion(
          ORG_ID,
          { pfEmployeeRate: 0.12 },
          'user-1',
          'no-op test',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.payrollConfigVersion.create).not.toHaveBeenCalled();
    });

    it('deactivates the old version and creates a new one instead of overwriting in place', async () => {
      await service.createNewVersion(
        ORG_ID,
        { pfEmployeeRate: 0.1 },
        'user-1',
        'statutory rate change',
      );

      expect(prismaMock.payrollConfigVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'v1' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      const createCall =
        prismaMock.payrollConfigVersion.create.mock.calls[0][0];
      expect(createCall.data.version).toBe(2);
      expect(createCall.data.isActive).toBe(true);
      expect(createCall.data.pfEmployeeRate).toBe(0.1);
    });

    it('writes exactly one audit-log row per changed field, with old/new values and the reason', async () => {
      await service.createNewVersion(
        ORG_ID,
        { pfEmployeeRate: 0.1, esiEnabled: false },
        'user-1',
        'statutory rate change',
      );

      const auditData =
        prismaMock.payrollConfigAuditLog.createMany.mock.calls[0][0].data;
      expect(auditData).toHaveLength(2);
      const pfEntry = auditData.find(
        (e: any) => e.fieldName === 'pfEmployeeRate',
      );
      expect(pfEntry).toMatchObject({
        organizationId: ORG_ID,
        oldValue: '0.12',
        newValue: '0.1',
        changedBy: 'user-1',
        reason: 'statutory rate change',
      });
      const esiEntry = auditData.find((e: any) => e.fieldName === 'esiEnabled');
      expect(esiEntry).toMatchObject({ oldValue: 'true', newValue: 'false' });
    });

    it('does not touch fields the caller did not include in the update', async () => {
      await service.createNewVersion(
        ORG_ID,
        { pfEmployeeRate: 0.1 },
        'user-1',
        'statutory rate change',
      );

      const createCall =
        prismaMock.payrollConfigVersion.create.mock.calls[0][0];
      expect(createCall.data.esiEmployeeRate).toBe(CURRENT.esiEmployeeRate);
      expect(createCall.data.ptState).toBe(CURRENT.ptState);
    });
  });

  describe('getEffectiveConfig', () => {
    it('returns the version whose window covers the requested date', async () => {
      const row = {
        ...({} as any),
        id: 'v1',
        pfEmployeeRate: 0.11,
        ptSlabsJson: '[]',
        employmentTypeDefaultsJson: '{}',
      };
      prismaMock.payrollConfigVersion.findFirst.mockResolvedValue(row);

      const result = await service.getEffectiveConfig(
        ORG_ID,
        new Date('2026-03-01'),
      );

      expect(result.pfEmployeeRate).toBe(0.11);
      expect(prismaMock.payrollConfigVersion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            effectiveFrom: { lte: new Date('2026-03-01') },
          }),
        }),
      );
    });

    it('falls back to the current config when no version covers the requested date', async () => {
      prismaMock.payrollConfigVersion.findFirst
        .mockResolvedValueOnce(null) // effective-window lookup finds nothing
        .mockResolvedValueOnce({
          id: 'v1',
          version: 1,
          pfEmployeeRate: 0.12,
          ptSlabsJson: '[]',
          employmentTypeDefaultsJson: '{}',
        }); // getCurrentVersion fallback

      const result = await service.getEffectiveConfig(
        ORG_ID,
        new Date('2020-01-01'),
      );

      expect(result.pfEmployeeRate).toBe(0.12);
    });
  });
});
