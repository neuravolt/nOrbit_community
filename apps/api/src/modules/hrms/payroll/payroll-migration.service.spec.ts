import { PayrollMigrationService } from './payroll-migration.service';

// Gap-closure item 4/5 — the explicit legacy-to-dynamic-component migration
// path: creates standard component definitions + per-employee assignments
// synthesized from EmployeeSalary's existing fixed fields, never touches
// EmployeeSalary itself, and is idempotent (a second run is a no-op for
// anyone/anything already migrated).
describe('PayrollMigrationService', () => {
  let prismaMock: any;
  let auditMock: any;
  let service: PayrollMigrationService;

  const ORG_ID = 'org-1';
  const ACTOR_ID = 'actor-1';

  const SALARY = {
    userId: 'emp-1',
    basicSalary: 40000,
    hra: 16000,
    conveyanceAllowance: 1600,
    specialAllowance: 0,
    daAllowance: 0,
    otherAllowance: 0,
  };

  beforeEach(() => {
    prismaMock = {
      salaryComponent: { findFirst: jest.fn(), create: jest.fn() },
      employeeSalary: { findMany: jest.fn(), update: jest.fn() },
      employeeSalaryComponent: { count: jest.fn(), create: jest.fn() },
    };
    auditMock = { recordAction: jest.fn() };
    service = new PayrollMigrationService(prismaMock, auditMock);
  });

  it('creates the 6 standard components when none exist yet', async () => {
    prismaMock.salaryComponent.findFirst.mockResolvedValue(null);
    prismaMock.salaryComponent.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `comp-${data.code}`, ...data }),
    );
    prismaMock.employeeSalary.findMany.mockResolvedValue([]);

    const summary = await service.migrateOrganization(
      ORG_ID,
      ACTOR_ID,
      'Initial migration',
    );

    expect(summary.componentsCreated).toBe(6);
    expect(summary.componentsAlreadyExisted).toBe(0);
    expect(prismaMock.employeeSalary.update).not.toHaveBeenCalled(); // legacy data never modified
  });

  it('skips components that already exist (idempotent)', async () => {
    prismaMock.salaryComponent.findFirst.mockResolvedValue({
      id: 'existing-comp',
    });
    prismaMock.employeeSalary.findMany.mockResolvedValue([]);

    const summary = await service.migrateOrganization(ORG_ID, ACTOR_ID);

    expect(summary.componentsCreated).toBe(0);
    expect(summary.componentsAlreadyExisted).toBe(6);
    expect(prismaMock.salaryComponent.create).not.toHaveBeenCalled();
  });

  it('synthesizes one EmployeeSalaryComponent per nonzero legacy field for an unmigrated employee', async () => {
    prismaMock.salaryComponent.findFirst.mockResolvedValue({ id: 'comp-x' });
    prismaMock.employeeSalary.findMany.mockResolvedValue([SALARY]);
    prismaMock.employeeSalaryComponent.count.mockResolvedValue(0);
    prismaMock.employeeSalaryComponent.create.mockResolvedValue({
      id: 'assign-1',
    });

    const summary = await service.migrateOrganization(
      ORG_ID,
      ACTOR_ID,
      'Migrate employee',
    );

    // basicSalary, hra, conveyanceAllowance are nonzero -> 3 assignments; the
    // zero-valued fields (special/da/other) are skipped.
    expect(prismaMock.employeeSalaryComponent.create).toHaveBeenCalledTimes(3);
    expect(summary.employeesMigrated).toBe(1);
    expect(summary.employeesAlreadyMigrated).toBe(0);
  });

  it('skips an employee who already has component assignments (idempotent)', async () => {
    prismaMock.salaryComponent.findFirst.mockResolvedValue({ id: 'comp-x' });
    prismaMock.employeeSalary.findMany.mockResolvedValue([SALARY]);
    prismaMock.employeeSalaryComponent.count.mockResolvedValue(2); // already migrated

    const summary = await service.migrateOrganization(ORG_ID, ACTOR_ID);

    expect(prismaMock.employeeSalaryComponent.create).not.toHaveBeenCalled();
    expect(summary.employeesAlreadyMigrated).toBe(1);
    expect(summary.employeesMigrated).toBe(0);
  });

  it('records an audit action for each created component and each synthesized assignment', async () => {
    prismaMock.salaryComponent.findFirst.mockResolvedValue(null);
    prismaMock.salaryComponent.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `comp-${data.code}`, ...data }),
    );
    prismaMock.employeeSalary.findMany.mockResolvedValue([SALARY]);
    prismaMock.employeeSalaryComponent.count.mockResolvedValue(0);
    prismaMock.employeeSalaryComponent.create.mockResolvedValue({
      id: 'assign-1',
    });

    await service.migrateOrganization(ORG_ID, ACTOR_ID, 'Full migration');

    // 6 component-creation audit rows + 3 assignment audit rows for this employee
    expect(auditMock.recordAction).toHaveBeenCalledTimes(6 + 3);
    expect(auditMock.recordAction).toHaveBeenCalledWith(
      ORG_ID,
      'SALARY_COMPONENT',
      expect.any(String),
      'CREATE',
      ACTOR_ID,
      'Full migration',
      expect.any(Object),
    );
    expect(auditMock.recordAction).toHaveBeenCalledWith(
      ORG_ID,
      'EMPLOYEE_SALARY_COMPONENT',
      'assign-1',
      'ASSIGN',
      ACTOR_ID,
      'Full migration',
      expect.any(Object),
    );
  });
});
