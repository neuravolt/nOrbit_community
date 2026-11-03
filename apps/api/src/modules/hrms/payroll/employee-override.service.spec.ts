import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmployeeOverrideService } from './employee-override.service';

// Gap-closure item 1/2/5 — employee statutory/payroll overrides: validated,
// audited (actor/reason/old/new), and this is the exact hierarchy
// calculateEmployeePayroll consumes via PayrollWorkflowService's
// statutoryOverrides input (Employee Override -> Org Config -> Statutory
// Default).
describe('EmployeeOverrideService', () => {
  let prismaMock: any;
  let auditMock: any;
  let service: EmployeeOverrideService;

  const ORG_ID = 'org-1';
  const USER_ID = 'emp-1';

  beforeEach(() => {
    prismaMock = {
      employeeSalary: { findFirst: jest.fn(), update: jest.fn() },
      employeeSalaryComponent: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    auditMock = { recordDiff: jest.fn() };
    service = new EmployeeOverrideService(prismaMock, auditMock);
  });

  describe('updateStatutoryOverrides', () => {
    const EXISTING = {
      id: 'sal-1',
      userId: USER_ID,
      status: 'ACTIVE',
      pfApplicable: true,
      pfWageCeiling: 15000,
      voluntaryPfPercent: 0,
      esiApplicable: true,
      esiGrossCeiling: 21000,
      professionalTaxOverride: null,
      taxRegime: 'NEW',
    };

    beforeEach(() => {
      prismaMock.employeeSalary.findFirst.mockResolvedValue(EXISTING);
    });

    it('rejects with no reason', async () => {
      await expect(
        service.updateStatutoryOverrides(
          USER_ID,
          ORG_ID,
          { pfWageCeiling: 20000 },
          'actor-1',
          '',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when the employee has no active salary record', async () => {
      prismaMock.employeeSalary.findFirst.mockResolvedValue(null);
      await expect(
        service.updateStatutoryOverrides(
          USER_ID,
          ORG_ID,
          { pfWageCeiling: 20000 },
          'actor-1',
          'test',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a negative pfWageCeiling', async () => {
      await expect(
        service.updateStatutoryOverrides(
          USER_ID,
          ORG_ID,
          { pfWageCeiling: -1 },
          'actor-1',
          'test',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies the override and records an audited diff with old/new values and reason', async () => {
      const updated = { ...EXISTING, pfWageCeiling: 25000 };
      prismaMock.employeeSalary.update.mockResolvedValue(updated);

      const result = await service.updateStatutoryOverrides(
        USER_ID,
        ORG_ID,
        { pfWageCeiling: 25000 },
        'actor-1',
        'High-package PF opt-up',
      );

      expect(result.pfWageCeiling).toBe(25000);
      expect(auditMock.recordDiff).toHaveBeenCalledWith(
        ORG_ID,
        'EMPLOYEE_OVERRIDE',
        'sal-1',
        'actor-1',
        'High-package PF opt-up',
        EXISTING,
        updated,
        expect.arrayContaining(['pfWageCeiling']),
      );
    });

    it('a professionalTaxOverride of exactly 0 (explicit waiver) is preserved, not treated as unset', async () => {
      const updated = { ...EXISTING, professionalTaxOverride: 0 };
      prismaMock.employeeSalary.update.mockResolvedValue(updated);

      const result = await service.updateStatutoryOverrides(
        USER_ID,
        ORG_ID,
        { professionalTaxOverride: 0 },
        'actor-1',
        'PT waived for this employee',
      );

      expect(result.professionalTaxOverride).toBe(0);
      const updateCallData =
        prismaMock.employeeSalary.update.mock.calls[0][0].data;
      expect(updateCallData.professionalTaxOverride).toBe(0);
    });
  });

  describe('updateComponentOverride', () => {
    it('rejects with no reason', async () => {
      prismaMock.employeeSalaryComponent.findUnique.mockResolvedValue({
        id: 'assign-1',
      });
      await expect(
        service.updateComponentOverride(
          'assign-1',
          ORG_ID,
          { amountOverride: 1000 },
          'actor-1',
          '',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a negative amountOverride', async () => {
      prismaMock.employeeSalaryComponent.findUnique.mockResolvedValue({
        id: 'assign-1',
      });
      await expect(
        service.updateComponentOverride(
          'assign-1',
          ORG_ID,
          { amountOverride: -50 },
          'actor-1',
          'test',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('records an audited diff on the EMPLOYEE_SALARY_COMPONENT entity', async () => {
      const existing = {
        id: 'assign-1',
        amountOverride: 1000,
        percentageOverride: null,
        isEligible: true,
      };
      const updated = { ...existing, amountOverride: 1500 };
      prismaMock.employeeSalaryComponent.findUnique.mockResolvedValue(existing);
      prismaMock.employeeSalaryComponent.update.mockResolvedValue(updated);

      await service.updateComponentOverride(
        'assign-1',
        ORG_ID,
        { amountOverride: 1500 },
        'actor-1',
        'Rate revised',
      );

      expect(auditMock.recordDiff).toHaveBeenCalledWith(
        ORG_ID,
        'EMPLOYEE_SALARY_COMPONENT',
        'assign-1',
        'actor-1',
        'Rate revised',
        existing,
        updated,
        expect.arrayContaining(['amountOverride']),
      );
    });
  });
});
