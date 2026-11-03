import { BadRequestException } from '@nestjs/common';
import { SalaryComponentService } from './salary-component.service';

// Gap-closure item 2/5 — every mutation of a SalaryComponent must produce an
// audit trail entry recording actor, reason, and (for updates) old/new value
// per changed field.
describe('SalaryComponentService — audit trail', () => {
  let prismaMock: any;
  let auditMock: any;
  let service: SalaryComponentService;

  const ORG_ID = 'org-1';
  const USER_ID = 'user-1';

  beforeEach(() => {
    prismaMock = {
      salaryComponent: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      employeeSalaryComponent: { create: jest.fn() },
    };
    auditMock = { recordAction: jest.fn(), recordDiff: jest.fn() };
    service = new SalaryComponentService(prismaMock, auditMock);
  });

  describe('create()', () => {
    it('records a CREATE action with actor and reason', async () => {
      prismaMock.salaryComponent.findFirst.mockResolvedValue(null);
      const created = {
        id: 'comp-1',
        code: 'BONUS',
        name: 'Bonus',
        type: 'EARNING',
        calcType: 'FIXED',
      };
      prismaMock.salaryComponent.create.mockResolvedValue(created);

      await service.create(
        ORG_ID,
        { code: 'BONUS', name: 'Bonus', type: 'EARNING' },
        USER_ID,
        'New performance bonus component',
      );

      expect(auditMock.recordAction).toHaveBeenCalledWith(
        ORG_ID,
        'SALARY_COMPONENT',
        'comp-1',
        'CREATE',
        USER_ID,
        'New performance bonus component',
        expect.objectContaining({ code: 'BONUS' }),
      );
    });
  });

  describe('update()', () => {
    const EXISTING = {
      id: 'comp-1',
      organizationId: ORG_ID,
      code: 'BONUS',
      name: 'Bonus',
      type: 'EARNING',
      calcType: 'FIXED',
      fixedAmount: 1000,
      percentage: null,
      formula: null,
    };

    beforeEach(() => {
      prismaMock.salaryComponent.findUnique.mockResolvedValue(EXISTING);
    });

    it('rejects an update with no reason', async () => {
      await expect(
        service.update('comp-1', { fixedAmount: 2000 }, ORG_ID, USER_ID, ''),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.salaryComponent.update).not.toHaveBeenCalled();
    });

    it('records a per-field diff with old and new values and the reason', async () => {
      const updated = { ...EXISTING, fixedAmount: 2000 };
      prismaMock.salaryComponent.update.mockResolvedValue(updated);

      await service.update(
        'comp-1',
        { fixedAmount: 2000 },
        ORG_ID,
        USER_ID,
        'Annual bonus revision',
      );

      expect(auditMock.recordDiff).toHaveBeenCalledWith(
        ORG_ID,
        'SALARY_COMPONENT',
        'comp-1',
        USER_ID,
        'Annual bonus revision',
        EXISTING,
        updated,
        expect.arrayContaining(['fixedAmount']),
      );
    });
  });

  describe('deactivate()', () => {
    it('rejects deactivation with no reason', async () => {
      prismaMock.salaryComponent.findUnique.mockResolvedValue({
        id: 'comp-1',
        organizationId: ORG_ID,
      });
      await expect(
        service.deactivate('comp-1', ORG_ID, USER_ID, ''),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('records a DEACTIVATE action with the reason', async () => {
      prismaMock.salaryComponent.findUnique.mockResolvedValue({
        id: 'comp-1',
        organizationId: ORG_ID,
      });
      prismaMock.salaryComponent.update.mockResolvedValue({
        id: 'comp-1',
        isActive: false,
      });

      await service.deactivate(
        'comp-1',
        ORG_ID,
        USER_ID,
        'Component no longer offered',
      );

      expect(auditMock.recordAction).toHaveBeenCalledWith(
        ORG_ID,
        'SALARY_COMPONENT',
        'comp-1',
        'DEACTIVATE',
        USER_ID,
        'Component no longer offered',
      );
    });
  });

  describe('assignToEmployee()', () => {
    it('records an ASSIGN action on the EMPLOYEE_SALARY_COMPONENT entity type', async () => {
      prismaMock.salaryComponent.findUnique.mockResolvedValue({ id: 'comp-1' });
      prismaMock.employeeSalaryComponent.create.mockResolvedValue({
        id: 'assign-1',
      });

      await service.assignToEmployee(
        'comp-1',
        'emp-1',
        { amountOverride: 500 },
        USER_ID,
        ORG_ID,
        'Custom rate for this employee',
      );

      expect(auditMock.recordAction).toHaveBeenCalledWith(
        ORG_ID,
        'EMPLOYEE_SALARY_COMPONENT',
        'assign-1',
        'ASSIGN',
        USER_ID,
        'Custom rate for this employee',
        expect.objectContaining({ userId: 'emp-1', componentId: 'comp-1' }),
      );
    });
  });
});
