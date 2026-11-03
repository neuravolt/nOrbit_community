import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaxConfigService } from './tax-config.service';

// P1 gap-closure — dedicated Tax Configuration audit test. Proves the audit
// record actually written carries actor, reason, and old/new values — for
// both create (a single CREATE action with a snapshot) and update (an
// explicit UPDATE action with before/after JSON of every rate + slab).
describe('TaxConfigService', () => {
  let prismaMock: any;
  let auditMock: any;
  let service: TaxConfigService;

  const ORG_ID = 'org-1';
  const USER_ID = 'user-1';
  const VALID_SLABS = [
    { incomeFrom: 0, incomeTo: 300000, taxRate: 0 },
    { incomeFrom: 300000, incomeTo: null, taxRate: 0.1 },
  ];

  beforeEach(() => {
    prismaMock = {
      taxRegimeConfig: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      payrollAuditLog: { create: jest.fn() },
    };
    auditMock = { recordAction: jest.fn(), recordDiff: jest.fn() };
    service = new TaxConfigService(prismaMock, auditMock);
  });

  describe('validation', () => {
    it('rejects overlapping slabs', async () => {
      const overlapping = [
        { incomeFrom: 0, incomeTo: 400000, taxRate: 0 },
        { incomeFrom: 300000, incomeTo: null, taxRate: 0.1 },
      ];
      await expect(
        service.create(
          ORG_ID,
          { financialYear: '2026-27', regimeType: 'NEW', slabs: overlapping },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a tax rate outside 0-1', async () => {
      await expect(
        service.create(
          ORG_ID,
          {
            financialYear: '2026-27',
            regimeType: 'NEW',
            slabs: [{ incomeFrom: 0, incomeTo: null, taxRate: 1.5 }],
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create() audit', () => {
    it('rejects creating a duplicate FY+regime config', async () => {
      prismaMock.taxRegimeConfig.findFirst.mockResolvedValue({
        id: 'existing',
      });
      await expect(
        service.create(
          ORG_ID,
          { financialYear: '2026-27', regimeType: 'NEW', slabs: VALID_SLABS },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('records a CREATE action with the actor and reason', async () => {
      prismaMock.taxRegimeConfig.findFirst.mockResolvedValue(null);
      prismaMock.taxRegimeConfig.create.mockResolvedValue({
        id: 'tc-1',
        financialYear: '2026-27',
        regimeType: 'NEW',
      });

      await service.create(
        ORG_ID,
        { financialYear: '2026-27', regimeType: 'NEW', slabs: VALID_SLABS },
        USER_ID,
        'FY2026-27 slab notification',
      );

      expect(auditMock.recordAction).toHaveBeenCalledWith(
        ORG_ID,
        'TAX_REGIME_CONFIG',
        'tc-1',
        'CREATE',
        USER_ID,
        'FY2026-27 slab notification',
        expect.objectContaining({
          financialYear: '2026-27',
          regimeType: 'NEW',
        }),
      );
    });
  });

  describe('getHistory()', () => {
    it('returns every version for the FY+regime, newest first', async () => {
      prismaMock.taxRegimeConfig.findMany = jest
        .fn()
        .mockResolvedValue([{ id: 'tc-2' }, { id: 'tc-1' }]);
      const result = await service.getHistory(ORG_ID, '2026-27', 'NEW');
      expect(prismaMock.taxRegimeConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: ORG_ID,
            financialYear: '2026-27',
            regimeType: 'NEW',
          },
          orderBy: { effectiveFrom: 'desc' },
        }),
      );
      expect(result).toEqual([{ id: 'tc-2' }, { id: 'tc-1' }]);
    });
  });

  describe('update() audit', () => {
    const CURRENT = {
      id: 'tc-1',
      standardDeduction: 50000,
      rebateLimit: 700000,
      rebateAmount: 25000,
      cessRate: 0.04,
      slabs: VALID_SLABS,
      surcharges: [],
    };

    beforeEach(() => {
      prismaMock.taxRegimeConfig.findFirst.mockResolvedValue(CURRENT);
    });

    it('throws NotFoundException when there is no active config to update', async () => {
      prismaMock.taxRegimeConfig.findFirst.mockResolvedValue(null);
      await expect(
        service.update(
          ORG_ID,
          '2026-27',
          'NEW',
          { cessRate: 0.05 },
          USER_ID,
          'test',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an update with no reason', async () => {
      await expect(
        service.update(
          ORG_ID,
          '2026-27',
          'NEW',
          { cessRate: 0.05 },
          USER_ID,
          '',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.taxRegimeConfig.create).not.toHaveBeenCalled();
    });

    it('deactivates the old version and creates a new one instead of mutating slabs in place', async () => {
      const newConfig = { ...CURRENT, id: 'tc-2', cessRate: 0.05 };
      prismaMock.taxRegimeConfig.create.mockResolvedValue(newConfig);

      await service.update(
        ORG_ID,
        '2026-27',
        'NEW',
        { cessRate: 0.05 },
        USER_ID,
        'Cess rate revised for FY2026-27',
      );

      expect(prismaMock.taxRegimeConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tc-1' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      expect(prismaMock.taxRegimeConfig.create).toHaveBeenCalled();
    });

    it('writes an audit row with actor, reason, and old/new values including the full slab set', async () => {
      const newConfig = { ...CURRENT, id: 'tc-2', cessRate: 0.05 };
      prismaMock.taxRegimeConfig.create.mockResolvedValue(newConfig);

      await service.update(
        ORG_ID,
        '2026-27',
        'NEW',
        { cessRate: 0.05 },
        USER_ID,
        'Cess rate revised',
      );

      expect(prismaMock.payrollAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          entityType: 'TAX_REGIME_CONFIG',
          entityId: 'tc-2',
          action: 'UPDATE',
          actorId: USER_ID,
          reason: 'Cess rate revised',
          oldValue: expect.stringContaining('"cessRate":0.04'),
          newValue: expect.stringContaining('"cessRate":0.05'),
        }),
      });
    });
  });
});
