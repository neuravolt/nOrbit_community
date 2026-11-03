import { PayrollAuditService } from './payroll-audit.service';

describe('PayrollAuditService', () => {
  let prismaMock: any;
  let service: PayrollAuditService;

  beforeEach(() => {
    prismaMock = {
      payrollAuditLog: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new PayrollAuditService(prismaMock);
  });

  describe('recordDiff', () => {
    it('writes one row per changed field only, with old and new values', async () => {
      await service.recordDiff(
        'org-1',
        'SALARY_COMPONENT',
        'comp-1',
        'actor-1',
        'rate revision',
        { fixedAmount: 1000, name: 'Bonus', displayOrder: 1 },
        { fixedAmount: 2000, name: 'Bonus', displayOrder: 1 },
        ['fixedAmount', 'name', 'displayOrder'],
      );

      const rows = prismaMock.payrollAuditLog.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        fieldName: 'fixedAmount',
        oldValue: '1000',
        newValue: '2000',
        actorId: 'actor-1',
        reason: 'rate revision',
      });
    });

    it('writes nothing and does not call createMany when nothing changed', async () => {
      await service.recordDiff(
        'org-1',
        'SALARY_COMPONENT',
        'comp-1',
        'actor-1',
        'no-op',
        { a: 1 },
        { a: 1 },
        ['a'],
      );
      expect(prismaMock.payrollAuditLog.createMany).not.toHaveBeenCalled();
    });

    it('ignores fields not in the tracked list even if they differ', async () => {
      await service.recordDiff(
        'org-1',
        'SALARY_COMPONENT',
        'comp-1',
        'actor-1',
        'x',
        { tracked: 1, untracked: 'old' },
        { tracked: 1, untracked: 'new' },
        ['tracked'],
      );
      expect(prismaMock.payrollAuditLog.createMany).not.toHaveBeenCalled();
    });

    it('serializes object values as JSON for comparison and storage', async () => {
      await service.recordDiff(
        'org-1',
        'HOLIDAY_CALENDAR',
        'cal-1',
        'actor-1',
        'x',
        { meta: { a: 1 } },
        { meta: { a: 2 } },
        ['meta'],
      );
      const rows = prismaMock.payrollAuditLog.createMany.mock.calls[0][0].data;
      expect(rows[0].oldValue).toBe(JSON.stringify({ a: 1 }));
      expect(rows[0].newValue).toBe(JSON.stringify({ a: 2 }));
    });

    it('records null->value and value->null transitions correctly', async () => {
      await service.recordDiff(
        'org-1',
        'EMPLOYEE_OVERRIDE',
        'sal-1',
        'actor-1',
        'x',
        { pt: null },
        { pt: 0 },
        ['pt'],
      );
      const rows = prismaMock.payrollAuditLog.createMany.mock.calls[0][0].data;
      expect(rows[0].oldValue).toBeNull();
      expect(rows[0].newValue).toBe('0');
    });
  });

  describe('recordAction', () => {
    it('writes a single row with the action, actor, reason, and a JSON snapshot', async () => {
      await service.recordAction(
        'org-1',
        'PAYROLL_ADJUSTMENT',
        'adj-1',
        'APPROVE',
        'actor-1',
        'verified',
      );
      expect(prismaMock.payrollAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          entityType: 'PAYROLL_ADJUSTMENT',
          entityId: 'adj-1',
          action: 'APPROVE',
          actorId: 'actor-1',
          reason: 'verified',
        }),
      });
    });
  });

  describe('listAll', () => {
    it('applies entityType/action/actorId/date filters and caps the limit at 500', async () => {
      prismaMock.payrollAuditLog.findMany.mockResolvedValue([]);
      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-12-31');

      await service.listAll(
        'org-1',
        {
          entityType: 'SALARY_COMPONENT',
          action: 'UPDATE',
          actorId: 'actor-1',
          dateFrom,
          dateTo,
        },
        9999,
      );

      expect(prismaMock.payrollAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          entityType: 'SALARY_COMPONENT',
          action: 'UPDATE',
          actorId: 'actor-1',
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
    });

    it('with no filters, returns everything for the org up to the default limit', async () => {
      prismaMock.payrollAuditLog.findMany.mockResolvedValue([]);
      await service.listAll('org-1');
      expect(prismaMock.payrollAuditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });
  });

  describe('history', () => {
    it('queries by organization, entity type, and entity id, newest first', async () => {
      prismaMock.payrollAuditLog.findMany.mockResolvedValue([]);
      await service.history('org-1', 'SALARY_COMPONENT', 'comp-1');
      expect(prismaMock.payrollAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          entityType: 'SALARY_COMPONENT',
          entityId: 'comp-1',
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
