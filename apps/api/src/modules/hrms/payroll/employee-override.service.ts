import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PayrollAuditService } from './payroll-audit.service';

// Section 17 — employee-level payroll overrides, audited. Deliberately reuses
// the existing EmployeeSalary override fields (pfWageCeiling, esiGrossCeiling,
// professionalTaxOverride, taxRegime, voluntaryPfPercent, pfApplicable,
// esiApplicable) rather than duplicating them onto a new model — this service
// is a focused, audited surface for editing exactly those fields (separate
// from the legacy upsertEmployeeSalary full-salary editor), plus per-employee
// SalaryComponent override editing. Hierarchy is Employee Override ->
// Organization Config -> Statutory Default, exactly as calculateEmployeePayroll
// already consumes these fields via PayrollWorkflowService.

export interface StatutoryOverrideDto {
  pfApplicable?: boolean;
  pfWageCeiling?: number;
  voluntaryPfPercent?: number;
  esiApplicable?: boolean;
  esiGrossCeiling?: number;
  professionalTaxOverride?: number | null;
  taxRegime?: 'OLD' | 'NEW';
}

const STATUTORY_AUDITED_FIELDS = [
  'pfApplicable',
  'pfWageCeiling',
  'voluntaryPfPercent',
  'esiApplicable',
  'esiGrossCeiling',
  'professionalTaxOverride',
  'taxRegime',
];

function validateStatutoryDto(dto: StatutoryOverrideDto) {
  if (dto.pfWageCeiling !== undefined && dto.pfWageCeiling < 0) {
    throw new BadRequestException('pfWageCeiling cannot be negative.');
  }
  if (
    dto.voluntaryPfPercent !== undefined &&
    (dto.voluntaryPfPercent < 0 || dto.voluntaryPfPercent > 88)
  ) {
    throw new BadRequestException(
      'voluntaryPfPercent must be between 0 and 88.',
    );
  }
  if (dto.esiGrossCeiling !== undefined && dto.esiGrossCeiling < 0) {
    throw new BadRequestException('esiGrossCeiling cannot be negative.');
  }
  if (
    dto.professionalTaxOverride !== undefined &&
    dto.professionalTaxOverride !== null &&
    dto.professionalTaxOverride < 0
  ) {
    throw new BadRequestException(
      'professionalTaxOverride cannot be negative.',
    );
  }
  if (
    dto.taxRegime !== undefined &&
    dto.taxRegime !== 'OLD' &&
    dto.taxRegime !== 'NEW'
  ) {
    throw new BadRequestException('taxRegime must be OLD or NEW.');
  }
}

@Injectable()
export class EmployeeOverrideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PayrollAuditService,
  ) {}

  async getOverrides(userId: string) {
    const salary = await this.prisma.employeeSalary.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { effectiveFrom: 'desc' },
    });
    const componentOverrides =
      await this.prisma.employeeSalaryComponent.findMany({
        where: { userId },
        include: { component: true },
      });
    return { statutory: salary, componentOverrides };
  }

  async updateStatutoryOverrides(
    userId: string,
    organizationId: string,
    dto: StatutoryOverrideDto,
    actorId: string,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException(
        'reason is required to change an employee statutory override.',
      );
    validateStatutoryDto(dto);
    const salary = await this.prisma.employeeSalary.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
    if (!salary)
      throw new NotFoundException('No active salary record for this employee.');

    const updated = await this.prisma.employeeSalary.update({
      where: { id: salary.id },
      data: {
        ...(dto.pfApplicable !== undefined
          ? { pfApplicable: dto.pfApplicable }
          : {}),
        ...(dto.pfWageCeiling !== undefined
          ? { pfWageCeiling: dto.pfWageCeiling }
          : {}),
        ...(dto.voluntaryPfPercent !== undefined
          ? { voluntaryPfPercent: dto.voluntaryPfPercent }
          : {}),
        ...(dto.esiApplicable !== undefined
          ? { esiApplicable: dto.esiApplicable }
          : {}),
        ...(dto.esiGrossCeiling !== undefined
          ? { esiGrossCeiling: dto.esiGrossCeiling }
          : {}),
        ...(dto.professionalTaxOverride !== undefined
          ? { professionalTaxOverride: dto.professionalTaxOverride }
          : {}),
        ...(dto.taxRegime !== undefined ? { taxRegime: dto.taxRegime } : {}),
      },
    });

    await this.audit.recordDiff(
      organizationId,
      'EMPLOYEE_OVERRIDE',
      salary.id,
      actorId,
      reason,
      salary,
      updated,
      STATUTORY_AUDITED_FIELDS,
    );
    return updated;
  }

  async updateComponentOverride(
    assignmentId: string,
    organizationId: string,
    dto: {
      amountOverride?: number | null;
      percentageOverride?: number | null;
      isEligible?: boolean;
    },
    actorId: string,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException(
        'reason is required to change a component override.',
      );
    if (
      dto.amountOverride !== undefined &&
      dto.amountOverride !== null &&
      dto.amountOverride < 0
    ) {
      throw new BadRequestException('amountOverride cannot be negative.');
    }
    if (
      dto.percentageOverride !== undefined &&
      dto.percentageOverride !== null &&
      (dto.percentageOverride < 0 || dto.percentageOverride > 5)
    ) {
      throw new BadRequestException(
        'percentageOverride must be between 0 and 5.',
      );
    }
    const existing = await this.prisma.employeeSalaryComponent.findUnique({
      where: { id: assignmentId },
    });
    if (!existing)
      throw new NotFoundException('Component assignment not found.');

    const updated = await this.prisma.employeeSalaryComponent.update({
      where: { id: assignmentId },
      data: {
        ...(dto.amountOverride !== undefined
          ? { amountOverride: dto.amountOverride }
          : {}),
        ...(dto.percentageOverride !== undefined
          ? { percentageOverride: dto.percentageOverride }
          : {}),
        ...(dto.isEligible !== undefined ? { isEligible: dto.isEligible } : {}),
      },
    });

    await this.audit.recordDiff(
      organizationId,
      'EMPLOYEE_SALARY_COMPONENT',
      assignmentId,
      actorId,
      reason,
      existing,
      updated,
      ['amountOverride', 'percentageOverride', 'isEligible'],
    );
    return updated;
  }
}
