import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PayrollFormulaEngine } from './formula-engine';
import { PayrollAuditService } from './payroll-audit.service';

const AUDITED_FIELDS = [
  'code',
  'name',
  'type',
  'calcType',
  'calcBase',
  'fixedAmount',
  'percentage',
  'formula',
  'frequency',
  'pfApplicable',
  'esiApplicable',
  'ptApplicable',
  'tdsApplicable',
  'proratable',
  'lwpAffected',
  'displayOrder',
  'effectiveTo',
  'isActive',
];

// Section 4/25 — dynamic salary component CRUD with server-side validation.
// Components are directly editable (not versioned like PayrollConfigVersion):
// what components existed and how they were configured at calculation time is
// captured immutably in PayrollRunSnapshot.salaryComponentsJson, which is the
// audit-safe historical record — versioning the component definitions
// themselves as well would duplicate that guarantee for no practical benefit.
// Documented here as a deliberate scope decision, not an oversight.

export interface SalaryComponentDto {
  code: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
  calcType?: string;
  calcBase?: string;
  fixedAmount?: number;
  percentage?: number;
  formula?: string;
  frequency?: string;
  pfApplicable?: boolean;
  esiApplicable?: boolean;
  ptApplicable?: boolean;
  tdsApplicable?: boolean;
  proratable?: boolean;
  lwpAffected?: boolean;
  displayOrder?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}

function validateDto(dto: SalaryComponentDto) {
  if (!dto.code || !dto.code.trim())
    throw new BadRequestException('code is required.');
  if (!dto.name || !dto.name.trim())
    throw new BadRequestException('name is required.');
  if (dto.type !== 'EARNING' && dto.type !== 'DEDUCTION') {
    throw new BadRequestException('type must be EARNING or DEDUCTION.');
  }
  if (dto.fixedAmount !== undefined && dto.fixedAmount < 0) {
    throw new BadRequestException('fixedAmount cannot be negative.');
  }
  if (
    dto.percentage !== undefined &&
    (dto.percentage < 0 || dto.percentage > 5)
  ) {
    throw new BadRequestException(
      'percentage must be between 0 and 5 (i.e. 0% to 500%).',
    );
  }
  if (dto.calcType === 'FORMULA') {
    if (!dto.formula || !dto.formula.trim()) {
      throw new BadRequestException(
        'formula is required when calcType is FORMULA.',
      );
    }
    const validation = PayrollFormulaEngine.validate(dto.formula);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid formula: ${validation.error}`);
    }
  }
  if (dto.effectiveFrom && dto.effectiveTo) {
    const from = new Date(dto.effectiveFrom);
    const to = new Date(dto.effectiveTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException(
        'effectiveFrom/effectiveTo must be valid dates.',
      );
    }
    if (to <= from) {
      throw new BadRequestException('effectiveTo must be after effectiveFrom.');
    }
  }
}

@Injectable()
export class SalaryComponentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PayrollAuditService,
  ) {}

  async list(
    organizationId: string,
    filters: { type?: string; isActive?: boolean } = {},
  ) {
    return this.prisma.salaryComponent.findMany({
      where: {
        OR: [{ organizationId }, { organizationId: null }],
        ...(filters.type ? { type: filters.type as any } : {}),
        ...(filters.isActive !== undefined
          ? { isActive: filters.isActive }
          : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(
    organizationId: string,
    dto: SalaryComponentDto,
    userId: string,
    reason?: string,
  ) {
    validateDto(dto);
    const existing = await this.prisma.salaryComponent.findFirst({
      where: { organizationId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(
        `A component with code "${dto.code}" already exists for this organization.`,
      );
    }
    const created = await this.prisma.salaryComponent.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        type: dto.type as any,
        calcType: (dto.calcType as any) ?? 'FIXED',
        calcBase: dto.calcBase,
        fixedAmount: dto.fixedAmount,
        percentage: dto.percentage,
        formula: dto.formula,
        frequency: (dto.frequency as any) ?? 'MONTHLY',
        pfApplicable: dto.pfApplicable ?? false,
        esiApplicable: dto.esiApplicable ?? false,
        ptApplicable: dto.ptApplicable ?? false,
        tdsApplicable: dto.tdsApplicable ?? true,
        proratable: dto.proratable ?? true,
        lwpAffected: dto.lwpAffected ?? true,
        displayOrder: dto.displayOrder ?? 0,
        effectiveFrom: dto.effectiveFrom
          ? new Date(dto.effectiveFrom)
          : new Date(),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        createdBy: userId,
      },
    });
    await this.audit.recordAction(
      organizationId,
      'SALARY_COMPONENT',
      created.id,
      'CREATE',
      userId,
      reason,
      {
        code: created.code,
        name: created.name,
        type: created.type,
        calcType: created.calcType,
      },
    );
    return created;
  }

  async update(
    id: string,
    dto: Partial<SalaryComponentDto>,
    organizationId: string,
    userId: string,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException(
        'reason is required to update a salary component.',
      );
    const existing = await this.prisma.salaryComponent.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Salary component not found.');
    if (existing.organizationId && existing.organizationId !== organizationId) {
      throw new BadRequestException(
        'Cannot modify a component belonging to a different organization.',
      );
    }
    if (existing.organizationId === null) {
      throw new BadRequestException(
        'Global components cannot be modified per-organization; create an org-scoped override instead.',
      );
    }

    const merged: SalaryComponentDto = {
      code: dto.code ?? existing.code,
      name: dto.name ?? existing.name,
      type: (dto.type as any) ?? existing.type,
      calcType: dto.calcType ?? existing.calcType,
      fixedAmount: dto.fixedAmount ?? existing.fixedAmount ?? undefined,
      percentage: dto.percentage ?? existing.percentage ?? undefined,
      formula: dto.formula ?? existing.formula ?? undefined,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo,
    };
    validateDto(merged);

    if (dto.code && dto.code !== existing.code) {
      const clash = await this.prisma.salaryComponent.findFirst({
        where: { organizationId, code: dto.code, NOT: { id } },
      });
      if (clash)
        throw new BadRequestException(
          `A component with code "${dto.code}" already exists.`,
        );
    }

    const updated = await this.prisma.salaryComponent.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type as any } : {}),
        ...(dto.calcType !== undefined
          ? { calcType: dto.calcType as any }
          : {}),
        ...(dto.calcBase !== undefined ? { calcBase: dto.calcBase } : {}),
        ...(dto.fixedAmount !== undefined
          ? { fixedAmount: dto.fixedAmount }
          : {}),
        ...(dto.percentage !== undefined ? { percentage: dto.percentage } : {}),
        ...(dto.formula !== undefined ? { formula: dto.formula } : {}),
        ...(dto.frequency !== undefined
          ? { frequency: dto.frequency as any }
          : {}),
        ...(dto.pfApplicable !== undefined
          ? { pfApplicable: dto.pfApplicable }
          : {}),
        ...(dto.esiApplicable !== undefined
          ? { esiApplicable: dto.esiApplicable }
          : {}),
        ...(dto.ptApplicable !== undefined
          ? { ptApplicable: dto.ptApplicable }
          : {}),
        ...(dto.tdsApplicable !== undefined
          ? { tdsApplicable: dto.tdsApplicable }
          : {}),
        ...(dto.proratable !== undefined ? { proratable: dto.proratable } : {}),
        ...(dto.lwpAffected !== undefined
          ? { lwpAffected: dto.lwpAffected }
          : {}),
        ...(dto.displayOrder !== undefined
          ? { displayOrder: dto.displayOrder }
          : {}),
        ...(dto.effectiveTo !== undefined
          ? { effectiveTo: new Date(dto.effectiveTo) }
          : {}),
      },
    });
    await this.audit.recordDiff(
      organizationId,
      'SALARY_COMPONENT',
      id,
      userId,
      reason,
      existing,
      updated,
      AUDITED_FIELDS,
    );
    return updated;
  }

  // Soft delete only — components already used in historical PayrollRunSnapshots
  // and Payslips must never disappear; deactivation just stops new assignment.
  async deactivate(
    id: string,
    organizationId: string,
    userId: string,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException(
        'reason is required to deactivate a salary component.',
      );
    const existing = await this.prisma.salaryComponent.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Salary component not found.');
    if (existing.organizationId !== organizationId) {
      throw new BadRequestException(
        'Cannot deactivate a component belonging to a different organization.',
      );
    }
    const updated = await this.prisma.salaryComponent.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.recordAction(
      organizationId,
      'SALARY_COMPONENT',
      id,
      'DEACTIVATE',
      userId,
      reason,
    );
    return updated;
  }

  async assignToEmployee(
    componentId: string,
    userId: string,
    overrides: {
      amountOverride?: number;
      percentageOverride?: number;
      isEligible?: boolean;
    },
    createdBy: string,
    organizationId: string,
    reason?: string,
  ) {
    const component = await this.prisma.salaryComponent.findUnique({
      where: { id: componentId },
    });
    if (!component) throw new NotFoundException('Salary component not found.');
    if (
      overrides.amountOverride !== undefined &&
      overrides.amountOverride < 0
    ) {
      throw new BadRequestException('amountOverride cannot be negative.');
    }
    if (
      overrides.percentageOverride !== undefined &&
      (overrides.percentageOverride < 0 || overrides.percentageOverride > 5)
    ) {
      throw new BadRequestException(
        'percentageOverride must be between 0 and 5.',
      );
    }
    const assignment = await this.prisma.employeeSalaryComponent.create({
      data: {
        userId,
        componentId,
        amountOverride: overrides.amountOverride,
        percentageOverride: overrides.percentageOverride,
        isEligible: overrides.isEligible ?? true,
        createdBy,
      },
    });
    await this.audit.recordAction(
      organizationId,
      'EMPLOYEE_SALARY_COMPONENT',
      assignment.id,
      'ASSIGN',
      createdBy,
      reason,
      {
        userId,
        componentId,
        ...overrides,
      },
    );
    return assignment;
  }

  async listForEmployee(userId: string) {
    return this.prisma.employeeSalaryComponent.findMany({
      where: {
        userId,
        isEligible: true,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      include: { component: true },
    });
  }
}
