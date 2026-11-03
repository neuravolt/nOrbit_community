import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PayrollAuditService } from './payroll-audit.service';

// Section 4 (gap-closure) — the explicit, admin-triggered migration/synthesis
// path from legacy EmployeeSalary fixed fields onto dynamic SalaryComponent
// rows. Purely additive: EmployeeSalary is never modified or deleted, and a
// second run is a no-op for anyone already migrated (idempotent). This is
// the deliberate, one-time counterpart to the always-on runtime fallback in
// PayrollWorkflowService.calculate() (synthesizeLegacyComponents) — that
// fallback keeps unmigrated employees calculating correctly right now, this
// service is how an org actually moves onto the dynamic system for full
// per-component configurability and audit granularity.

const STANDARD_COMPONENTS: Array<{
  code: string;
  name: string;
  pfApplicable: boolean;
  salaryField:
    | 'basicSalary'
    | 'hra'
    | 'conveyanceAllowance'
    | 'specialAllowance'
    | 'daAllowance'
    | 'otherAllowance';
}> = [
  {
    code: 'BASIC',
    name: 'Basic',
    pfApplicable: true,
    salaryField: 'basicSalary',
  },
  {
    code: 'HRA',
    name: 'House Rent Allowance',
    pfApplicable: false,
    salaryField: 'hra',
  },
  {
    code: 'CONVEYANCE',
    name: 'Conveyance Allowance',
    pfApplicable: false,
    salaryField: 'conveyanceAllowance',
  },
  {
    code: 'SPECIAL_ALLOWANCE',
    name: 'Special Allowance',
    pfApplicable: false,
    salaryField: 'specialAllowance',
  },
  {
    code: 'DA',
    name: 'Dearness Allowance',
    pfApplicable: false,
    salaryField: 'daAllowance',
  },
  {
    code: 'OTHER_ALLOWANCE',
    name: 'Other Allowance',
    pfApplicable: false,
    salaryField: 'otherAllowance',
  },
];

export interface MigrationSummary {
  componentsCreated: number;
  componentsAlreadyExisted: number;
  employeesMigrated: number;
  employeesAlreadyMigrated: number;
  employeesSkippedNoSalary: number;
}

@Injectable()
export class PayrollMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PayrollAuditService,
  ) {}

  async migrateOrganization(
    organizationId: string,
    actorId: string,
    reason?: string,
  ): Promise<MigrationSummary> {
    const summary: MigrationSummary = {
      componentsCreated: 0,
      componentsAlreadyExisted: 0,
      employeesMigrated: 0,
      employeesAlreadyMigrated: 0,
      employeesSkippedNoSalary: 0,
    };

    const codeToId = new Map<string, string>();
    for (const def of STANDARD_COMPONENTS) {
      const existing = await this.prisma.salaryComponent.findFirst({
        where: { organizationId, code: def.code },
      });
      if (existing) {
        codeToId.set(def.code, existing.id);
        summary.componentsAlreadyExisted += 1;
        continue;
      }
      const component = await this.prisma.salaryComponent.create({
        data: {
          organizationId,
          code: def.code,
          name: def.name,
          type: 'EARNING',
          calcType: 'FIXED',
          fixedAmount: 0,
          pfApplicable: def.pfApplicable,
          esiApplicable: true,
          ptApplicable: true,
          tdsApplicable: true,
          proratable: true,
          lwpAffected: true,
          createdBy: actorId,
        },
      });
      codeToId.set(def.code, component.id);
      summary.componentsCreated += 1;
      await this.audit.recordAction(
        organizationId,
        'SALARY_COMPONENT',
        component.id,
        'CREATE',
        actorId,
        reason ?? 'Auto-created during legacy-to-dynamic-component migration',
        { code: def.code },
      );
    }

    const activeSalaries = await this.prisma.employeeSalary.findMany({
      where: { status: 'ACTIVE', user: { organizationId } },
    });

    for (const sal of activeSalaries) {
      const existingAssignments =
        await this.prisma.employeeSalaryComponent.count({
          where: { userId: sal.userId },
        });
      if (existingAssignments > 0) {
        summary.employeesAlreadyMigrated += 1;
        continue;
      }

      let anyCreated = false;
      for (const def of STANDARD_COMPONENTS) {
        const amount = Number((sal as any)[def.salaryField] ?? 0);
        if (amount <= 0) continue; // don't assign a zero-value component
        const componentId = codeToId.get(def.code)!;
        const assignment = await this.prisma.employeeSalaryComponent.create({
          data: {
            userId: sal.userId,
            componentId,
            amountOverride: amount,
            isEligible: true,
            createdBy: actorId,
          },
        });
        anyCreated = true;
        await this.audit.recordAction(
          organizationId,
          'EMPLOYEE_SALARY_COMPONENT',
          assignment.id,
          'ASSIGN',
          actorId,
          reason ?? 'Synthesized from legacy EmployeeSalary during migration',
          { userId: sal.userId, code: def.code, amount },
        );
      }
      if (anyCreated) summary.employeesMigrated += 1;
      else summary.employeesSkippedNoSalary += 1;
    }

    return summary;
  }

  // Read-only check: how many active employees are already on dynamic
  // components vs. still relying on the runtime legacy-field fallback.
  async getMigrationStatus(organizationId: string) {
    const totalActive = await this.prisma.employeeSalary.count({
      where: { status: 'ACTIVE', user: { organizationId } },
    });
    const assignedUserRows = await this.prisma.employeeSalaryComponent.findMany(
      {
        where: { user: { organizationId } },
        select: { userId: true },
        distinct: ['userId'],
      },
    );
    const componentDefinitionsConfigured =
      await this.prisma.salaryComponent.count({
        where: { organizationId, isActive: true },
      });

    return {
      componentDefinitionsConfigured,
      totalActiveEmployees: totalActive,
      employeesUsingDynamicComponents: assignedUserRows.length,
      employeesStillOnLegacyFallback: Math.max(
        0,
        totalActive - assignedUserRows.length,
      ),
    };
  }
}
