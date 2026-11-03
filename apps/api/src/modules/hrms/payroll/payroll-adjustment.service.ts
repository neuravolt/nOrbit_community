import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PayrollAuditService } from './payroll-audit.service';

// Section 16 — arrears and manual adjustments. Every adjustment is auditable
// by construction: it's a row with createdBy/createdAt and, once approved,
// approvedBy/approvedAt — never a mutation of an existing payslip number.

export interface CreateAdjustmentDto {
  type:
    | 'ARREAR_SALARY'
    | 'ARREAR_INCREMENT'
    | 'ARREAR_PROMOTION'
    | 'CORRECTION'
    | 'MANUAL_EARNING'
    | 'MANUAL_DEDUCTION'
    | 'BONUS';
  amount: number;
  reason: string;
  targetMonth: number;
  targetYear: number;
}

const EARNING_TYPES = new Set([
  'ARREAR_SALARY',
  'ARREAR_INCREMENT',
  'ARREAR_PROMOTION',
  'MANUAL_EARNING',
  'BONUS',
]);

@Injectable()
export class PayrollAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PayrollAuditService,
  ) {}

  static isEarning(type: string): boolean {
    return EARNING_TYPES.has(type);
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateAdjustmentDto,
    createdBy: string,
  ) {
    if (!dto.reason?.trim())
      throw new BadRequestException(
        'reason is required for a payroll adjustment.',
      );
    if (!dto.amount || dto.amount <= 0)
      throw new BadRequestException('amount must be a positive number.');
    if (
      !Number.isInteger(dto.targetMonth) ||
      dto.targetMonth < 1 ||
      dto.targetMonth > 12
    ) {
      throw new BadRequestException('targetMonth must be between 1 and 12.');
    }
    if (
      !Number.isInteger(dto.targetYear) ||
      dto.targetYear < 2000 ||
      dto.targetYear > 2100
    ) {
      throw new BadRequestException('targetYear must be a valid year.');
    }
    const created = await this.prisma.payrollAdjustment.create({
      data: {
        organizationId,
        userId,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason,
        targetMonth: dto.targetMonth,
        targetYear: dto.targetYear,
        createdBy,
      },
    });
    await this.audit.recordAction(
      organizationId,
      'PAYROLL_ADJUSTMENT',
      created.id,
      'CREATE',
      createdBy,
      dto.reason,
      {
        userId,
        type: dto.type,
        amount: dto.amount,
        targetMonth: dto.targetMonth,
        targetYear: dto.targetYear,
      },
    );
    return created;
  }

  async approve(id: string, approverId: string, reason?: string) {
    const adjustment = await this.prisma.payrollAdjustment.findUnique({
      where: { id },
    });
    if (!adjustment) throw new NotFoundException('Adjustment not found.');
    if (adjustment.status !== 'PENDING') {
      throw new BadRequestException(
        `Adjustment is already ${adjustment.status}, cannot approve again.`,
      );
    }
    const updated = await this.prisma.payrollAdjustment.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });
    await this.audit.recordAction(
      adjustment.organizationId,
      'PAYROLL_ADJUSTMENT',
      id,
      'APPROVE',
      approverId,
      reason,
    );
    return updated;
  }

  async reject(id: string, approverId: string, reason?: string) {
    const adjustment = await this.prisma.payrollAdjustment.findUnique({
      where: { id },
    });
    if (!adjustment) throw new NotFoundException('Adjustment not found.');
    if (adjustment.status !== 'PENDING') {
      throw new BadRequestException(
        `Adjustment is already ${adjustment.status}, cannot reject.`,
      );
    }
    const updated = await this.prisma.payrollAdjustment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });
    await this.audit.recordAction(
      adjustment.organizationId,
      'PAYROLL_ADJUSTMENT',
      id,
      'REJECT',
      approverId,
      reason,
    );
    return updated;
  }

  async listPending(organizationId: string) {
    return this.prisma.payrollAdjustment.findMany({
      where: { organizationId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Adjustments to include in a calculation for this employee/period: either
  // still-APPROVED (not yet consumed by any run), or already APPLIED but
  // specifically to THIS run (payrollRunId) — the second clause is what makes
  // recalculating the same run idempotent. Bug this fixes, caught by the
  // real-database dry-run (never exercised by mocked single-calculate()
  // tests): calculate() marks matched adjustments APPLIED at the end of every
  // call, including recalculations. Without the second clause, a
  // recalculation's query for "APPROVED" adjustments would silently miss
  // anything already marked APPLIED by the run's own first calculate() — a
  // bonus/arrear present in the first calculation would vanish on the
  // second. Excluding adjustments APPLIED to a *different* run is still
  // enforced by the status filter, so cross-run double-counting remains
  // prevented.
  async getApprovedForPeriod(
    userId: string,
    month: number,
    year: number,
    payrollRunId?: string,
  ) {
    return this.prisma.payrollAdjustment.findMany({
      where: {
        userId,
        targetMonth: month,
        targetYear: year,
        OR: [
          { status: 'APPROVED' },
          ...(payrollRunId
            ? [{ status: 'APPLIED' as const, appliedInRunId: payrollRunId }]
            : []),
        ],
      },
    });
  }

  async markApplied(ids: string[], payrollRunId: string) {
    if (!ids.length) return;
    await this.prisma.payrollAdjustment.updateMany({
      where: { id: { in: ids } },
      data: { status: 'APPLIED', appliedInRunId: payrollRunId },
    });
  }
}
