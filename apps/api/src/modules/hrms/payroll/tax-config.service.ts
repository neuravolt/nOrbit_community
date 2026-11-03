import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  calculateAnnualTax,
  calculateMonthlyTds,
  TaxRegimeConfigInput,
} from './tds-calculator';
import { PayrollAuditService } from './payroll-audit.service';

// Section 10 — configurable, financial-year-versioned tax regime config. No
// slab/rate is hardcoded here; everything is read from TaxRegimeConfig/
// TaxSlab/TaxSurchargeSlab, validated for the overlap/range issues Section 25
// calls out explicitly.

export interface TaxSlabDto {
  incomeFrom: number;
  incomeTo?: number | null;
  taxRate: number;
}

export interface SurchargeSlabDto {
  incomeFrom: number;
  incomeTo?: number | null;
  surchargeRate: number;
}

export interface TaxRegimeConfigDto {
  financialYear: string;
  regimeType: 'OLD' | 'NEW';
  standardDeduction?: number;
  rebateLimit?: number;
  rebateAmount?: number;
  cessRate?: number;
  slabs: TaxSlabDto[];
  surcharges?: SurchargeSlabDto[];
}

function validateSlabs(slabs: TaxSlabDto[], label: string) {
  if (!slabs.length)
    throw new BadRequestException(`At least one ${label} is required.`);
  const sorted = [...slabs].sort((a, b) => a.incomeFrom - b.incomeFrom);
  for (const slab of sorted) {
    if (slab.incomeFrom < 0)
      throw new BadRequestException(`${label} incomeFrom cannot be negative.`);
    if (
      slab.incomeTo !== undefined &&
      slab.incomeTo !== null &&
      slab.incomeTo <= slab.incomeFrom
    ) {
      throw new BadRequestException(
        `${label} incomeTo must be greater than incomeFrom.`,
      );
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevEnd = prev.incomeTo ?? Infinity;
    if (curr.incomeFrom < prevEnd) {
      throw new BadRequestException(
        `${label}s must not overlap: ${JSON.stringify(prev)} overlaps ${JSON.stringify(curr)}.`,
      );
    }
  }
}

function validateDto(dto: TaxRegimeConfigDto) {
  if (!dto.financialYear?.trim())
    throw new BadRequestException(
      'financialYear is required (e.g. "2026-27").',
    );
  if (dto.regimeType !== 'OLD' && dto.regimeType !== 'NEW') {
    throw new BadRequestException('regimeType must be OLD or NEW.');
  }
  if (dto.cessRate !== undefined && (dto.cessRate < 0 || dto.cessRate > 1)) {
    throw new BadRequestException('cessRate must be between 0 and 1.');
  }
  validateSlabs(dto.slabs, 'tax slab');
  for (const slab of dto.slabs) {
    if (slab.taxRate < 0 || slab.taxRate > 1)
      throw new BadRequestException('taxRate must be between 0 and 1.');
  }
  if (dto.surcharges?.length) {
    validateSlabs(
      dto.surcharges.map((s) => ({
        incomeFrom: s.incomeFrom,
        incomeTo: s.incomeTo,
        taxRate: s.surchargeRate,
      })),
      'surcharge slab',
    );
    for (const s of dto.surcharges) {
      if (s.surchargeRate < 0 || s.surchargeRate > 1) {
        throw new BadRequestException('surchargeRate must be between 0 and 1.');
      }
    }
  }
}

@Injectable()
export class TaxConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PayrollAuditService,
  ) {}

  async create(
    organizationId: string,
    dto: TaxRegimeConfigDto,
    userId: string,
    reason?: string,
  ) {
    validateDto(dto);
    const existing = await this.prisma.taxRegimeConfig.findFirst({
      where: {
        organizationId,
        financialYear: dto.financialYear,
        regimeType: dto.regimeType,
      },
    });
    if (existing) {
      throw new BadRequestException(
        `A ${dto.regimeType} regime config already exists for FY ${dto.financialYear}. Use update instead.`,
      );
    }
    // P2 hardcoded-value audit: the ?? fallbacks below are admin-form
    // convenience defaults for a brand-new FY+regime config the admin is
    // creating (illustrative of a recent real figure, always overridable in
    // the same request) — never read at calculation time. Once this row
    // exists, every calculation reads the STORED value via getEffective() /
    // toEngineInput(), never these constants again.
    const created = await this.prisma.taxRegimeConfig.create({
      data: {
        organizationId,
        financialYear: dto.financialYear,
        regimeType: dto.regimeType,
        standardDeduction: dto.standardDeduction ?? 75000,
        rebateLimit: dto.rebateLimit ?? 700000,
        rebateAmount: dto.rebateAmount ?? 25000,
        cessRate: dto.cessRate ?? 0.04,
        createdBy: userId,
        slabs: {
          create: dto.slabs.map((s) => ({
            incomeFrom: s.incomeFrom,
            incomeTo: s.incomeTo ?? null,
            taxRate: s.taxRate,
          })),
        },
        surcharges: {
          create: (dto.surcharges ?? []).map((s) => ({
            incomeFrom: s.incomeFrom,
            incomeTo: s.incomeTo ?? null,
            surchargeRate: s.surchargeRate,
          })),
        },
      },
      include: { slabs: true, surcharges: true },
    });
    await this.audit.recordAction(
      organizationId,
      'TAX_REGIME_CONFIG',
      created.id,
      'CREATE',
      userId,
      reason,
      {
        financialYear: created.financialYear,
        regimeType: created.regimeType,
        slabs: dto.slabs,
        surcharges: dto.surcharges,
      },
    );
    return created;
  }

  // Tax config is effective-dated like PayrollConfigVersion: the old active
  // row is deactivated (isActive: false, effectiveTo: now), a new one is
  // created rather than the slabs being edited in place, so a historical
  // payroll snapshot's taxConfigJson always matches a real, never-mutated row.
  async update(
    organizationId: string,
    financialYear: string,
    regimeType: string,
    dto: Partial<TaxRegimeConfigDto>,
    userId: string,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException(
        'reason is required to update tax configuration.',
      );
    const current = await this.prisma.taxRegimeConfig.findFirst({
      where: { organizationId, financialYear, regimeType, isActive: true },
      include: { slabs: true, surcharges: true },
    });
    if (!current)
      throw new NotFoundException(
        `No active ${regimeType} tax config for FY ${financialYear} to update.`,
      );

    const merged: TaxRegimeConfigDto = {
      financialYear,
      regimeType: regimeType as any,
      standardDeduction: dto.standardDeduction ?? current.standardDeduction,
      rebateLimit: dto.rebateLimit ?? current.rebateLimit,
      rebateAmount: dto.rebateAmount ?? current.rebateAmount,
      cessRate: dto.cessRate ?? current.cessRate,
      slabs:
        dto.slabs ??
        current.slabs.map((s) => ({
          incomeFrom: s.incomeFrom,
          incomeTo: s.incomeTo,
          taxRate: s.taxRate,
        })),
      surcharges:
        dto.surcharges ??
        current.surcharges.map((s) => ({
          incomeFrom: s.incomeFrom,
          incomeTo: s.incomeTo,
          surchargeRate: s.surchargeRate,
        })),
    };
    validateDto(merged);

    const now = new Date();
    await this.prisma.taxRegimeConfig.update({
      where: { id: current.id },
      data: { isActive: false, effectiveTo: now },
    });

    const created = await this.prisma.taxRegimeConfig.create({
      data: {
        organizationId,
        financialYear,
        regimeType,
        standardDeduction: merged.standardDeduction,
        rebateLimit: merged.rebateLimit,
        rebateAmount: merged.rebateAmount,
        cessRate: merged.cessRate,
        createdBy: userId,
        effectiveFrom: now,
        slabs: {
          create: merged.slabs.map((s) => ({
            incomeFrom: s.incomeFrom,
            incomeTo: s.incomeTo ?? null,
            taxRate: s.taxRate,
          })),
        },
        surcharges: {
          create: (merged.surcharges ?? []).map((s) => ({
            incomeFrom: s.incomeFrom,
            incomeTo: s.incomeTo ?? null,
            surchargeRate: s.surchargeRate,
          })),
        },
      },
      include: { slabs: true, surcharges: true },
    });

    await this.prisma.payrollAuditLog.create({
      data: {
        organizationId,
        entityType: 'TAX_REGIME_CONFIG' as any,
        entityId: created.id,
        action: 'UPDATE' as any,
        oldValue: JSON.stringify({
          standardDeduction: current.standardDeduction,
          rebateLimit: current.rebateLimit,
          rebateAmount: current.rebateAmount,
          cessRate: current.cessRate,
          slabs: current.slabs,
          surcharges: current.surcharges,
        }),
        newValue: JSON.stringify({
          standardDeduction: created.standardDeduction,
          rebateLimit: created.rebateLimit,
          rebateAmount: created.rebateAmount,
          cessRate: created.cessRate,
          slabs: created.slabs,
          surcharges: created.surcharges,
        }),
        actorId: userId,
        reason,
      },
    });

    return created;
  }

  async getEffective(
    organizationId: string,
    financialYear: string,
    regimeType: string,
  ) {
    const config = await this.prisma.taxRegimeConfig.findFirst({
      where: { organizationId, financialYear, regimeType, isActive: true },
      include: { slabs: true, surcharges: true },
    });
    if (!config) {
      throw new NotFoundException(
        `No active ${regimeType} tax config for FY ${financialYear}.`,
      );
    }
    return config;
  }

  // Every version ever created for this FY+regime, newest first — shows the
  // admin UI which one is current (isActive) and what changed historically.
  async getHistory(
    organizationId: string,
    financialYear: string,
    regimeType: string,
  ) {
    return this.prisma.taxRegimeConfig.findMany({
      where: { organizationId, financialYear, regimeType },
      include: { slabs: true, surcharges: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  toEngineInput(config: {
    standardDeduction: number;
    rebateLimit: number;
    rebateAmount: number;
    cessRate: number;
    slabs: any[];
    surcharges: any[];
  }): TaxRegimeConfigInput {
    return {
      standardDeduction: config.standardDeduction,
      rebateLimit: config.rebateLimit,
      rebateAmount: config.rebateAmount,
      cessRate: config.cessRate,
      slabs: config.slabs.map((s) => ({
        incomeFrom: s.incomeFrom,
        incomeTo: s.incomeTo,
        taxRate: s.taxRate,
      })),
      surcharges: config.surcharges.map((s) => ({
        incomeFrom: s.incomeFrom,
        incomeTo: s.incomeTo,
        surchargeRate: s.surchargeRate,
      })),
    };
  }

  async computeMonthlyTds(
    organizationId: string,
    financialYear: string,
    regimeType: string,
    annualProjectedIncome: number,
    exemptions: number,
  ) {
    const config = await this.getEffective(
      organizationId,
      financialYear,
      regimeType,
    );
    const annual = calculateAnnualTax(
      annualProjectedIncome,
      exemptions,
      this.toEngineInput(config),
    );
    return calculateMonthlyTds(annual);
  }
}
