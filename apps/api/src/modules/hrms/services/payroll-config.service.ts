import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

// Enterprise Payroll Engine plan, Slice 1: PayrollConfigVersion replaces the flat,
// unversioned OrganizationSettings payroll-config block as the source of truth.
// Every write creates a new immutable version and a matching PayrollConfigAuditLog
// entry per changed field; nothing is ever overwritten in place.

const DEFAULT_CONFIG_FIELDS = {
  pfEnabled: true,
  pfEmployeeRate: 0.12,
  pfEmployerRate: 0.12,
  pfWageCeiling: 15000,
  pfApplyWageCap: true,
  highPackageBasicThreshold: 999999,
  highPackagePfOptional: false,
  esiEnabled: true,
  esiEmployeeRate: 0.0075,
  esiEmployerRate: 0.0325,
  esiGrossCeiling: 21000,
  ptEnabled: true,
  ptState: 'Karnataka',
  ptSlabsJson: JSON.stringify([
    { upTo: 14999, amount: 0 },
    { upTo: 19999, amount: 150 },
    { upTo: 9999999, amount: 200 },
  ]),
  lwpCalculationBase: 'CALENDAR',
  defaultConveyanceEmployee: 1600,
  defaultConveyanceIntern: 0,
  defaultConveyanceContract: 0,
  defaultTaxRegime: 'NEW',
  employmentTypeDefaultsJson: JSON.stringify({
    EMPLOYEE: { pfApplicable: true, esiApplicable: true },
    PAID_INTERN: { pfApplicable: false, esiApplicable: false, ptOverride: 0 },
    CONTRACT: { pfApplicable: false, esiApplicable: false, tdsRate: 0.1 },
    UNPAID_INTERN: {
      pfApplicable: false,
      esiApplicable: false,
      ptOverride: 0,
      skipPayroll: true,
    },
  }),
} as const;

const CONFIG_FIELD_NAMES = Object.keys(
  DEFAULT_CONFIG_FIELDS,
) as (keyof typeof DEFAULT_CONFIG_FIELDS)[];

function toApiShape(row: Record<string, any>) {
  return {
    pfEnabled: row.pfEnabled,
    pfEmployeeRate: row.pfEmployeeRate,
    pfEmployerRate: row.pfEmployerRate,
    pfWageCeiling: row.pfWageCeiling,
    pfApplyWageCap: row.pfApplyWageCap,
    highPackageBasicThreshold: row.highPackageBasicThreshold,
    highPackagePfOptional: row.highPackagePfOptional,
    esiEnabled: row.esiEnabled,
    esiEmployeeRate: row.esiEmployeeRate,
    esiEmployerRate: row.esiEmployerRate,
    esiGrossCeiling: row.esiGrossCeiling,
    ptEnabled: row.ptEnabled,
    ptState: row.ptState,
    ptSlabs: JSON.parse(row.ptSlabsJson || '[]'),
    lwpCalculationBase: row.lwpCalculationBase,
    defaultConveyanceEmployee: row.defaultConveyanceEmployee,
    defaultConveyanceIntern: row.defaultConveyanceIntern,
    defaultConveyanceContract: row.defaultConveyanceContract,
    defaultTaxRegime: row.defaultTaxRegime,
    employmentTypeDefaults: JSON.parse(row.employmentTypeDefaultsJson || '{}'),
    version: row.version,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    changeReason: row.changeReason,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PayrollConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // First-ever read/write for an org with no PayrollConfigVersion rows yet: seed
  // version 1 from the legacy OrganizationSettings payroll fields if a row exists
  // there (non-destructive — that row is left untouched), else from hardcoded
  // defaults matching the pre-existing statutory fallbacks.
  private async bootstrapFirstVersion(organizationId: string, userId: string) {
    const legacy = await this.prisma.organizationSettings.findUnique({
      where: { organizationId },
    });

    const seed: Record<string, any> = legacy
      ? {
          pfEnabled: legacy.pfEnabled,
          pfEmployeeRate: legacy.pfEmployeeRate,
          pfEmployerRate: legacy.pfEmployerRate,
          pfWageCeiling: legacy.pfWageCeiling,
          pfApplyWageCap: legacy.pfApplyWageCap,
          highPackageBasicThreshold: legacy.highPackageBasicThreshold,
          highPackagePfOptional: legacy.highPackagePfOptional,
          esiEnabled: legacy.esiEnabled,
          esiEmployeeRate: legacy.esiEmployeeRate,
          esiEmployerRate: legacy.esiEmployerRate,
          esiGrossCeiling: legacy.esiGrossCeiling,
          ptEnabled: legacy.ptEnabled,
          ptState: legacy.ptState,
          ptSlabsJson: legacy.ptSlabsJson,
          lwpCalculationBase: legacy.lwpCalculationBase,
          defaultConveyanceEmployee: legacy.defaultConveyanceEmployee,
          defaultConveyanceIntern: legacy.defaultConveyanceIntern,
          defaultConveyanceContract: legacy.defaultConveyanceContract,
          defaultTaxRegime: legacy.defaultTaxRegime,
          employmentTypeDefaultsJson: legacy.employmentTypeDefaultsJson,
        }
      : { ...DEFAULT_CONFIG_FIELDS };

    return this.prisma.payrollConfigVersion.create({
      data: {
        organizationId,
        version: 1,
        isActive: true,
        ...seed,
        effectiveFrom: new Date(),
        createdBy: userId,
        changeReason: legacy
          ? 'Bootstrapped from legacy OrganizationSettings payroll fields'
          : 'Initial default configuration',
      },
    });
  }

  async getCurrentVersion(organizationId: string, userId = 'system') {
    const active = await this.prisma.payrollConfigVersion.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (active) return active;
    return this.bootstrapFirstVersion(organizationId, userId);
  }

  async getCurrentConfig(organizationId: string) {
    const row = await this.getCurrentVersion(organizationId);
    return toApiShape(row);
  }

  async getEffectiveConfig(organizationId: string, date: Date) {
    const row = await this.prisma.payrollConfigVersion.findFirst({
      where: {
        organizationId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!row) {
      // No version's window covers this date (e.g. a date before the org's first
      // version) — fall back to the current config rather than 404, since the
      // legacy behavior always returned *something* usable.
      return this.getCurrentConfig(organizationId);
    }
    return toApiShape(row);
  }

  async getHistory(organizationId: string) {
    const rows = await this.prisma.payrollConfigVersion.findMany({
      where: { organizationId },
      orderBy: { version: 'desc' },
    });
    return rows.map(toApiShape);
  }

  async createNewVersion(
    organizationId: string,
    dto: Record<string, any>,
    userId: string,
    reason: string,
  ) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException(
        'changeReason is required to update payroll configuration.',
      );
    }

    const current = await this.getCurrentVersion(organizationId, userId);

    const next: Record<string, any> = {};
    for (const field of CONFIG_FIELD_NAMES) {
      next[field] = (current as any)[field];
    }
    if (dto.pfEnabled !== undefined) next.pfEnabled = Boolean(dto.pfEnabled);
    if (dto.pfEmployeeRate !== undefined)
      next.pfEmployeeRate = Number(dto.pfEmployeeRate);
    if (dto.pfEmployerRate !== undefined)
      next.pfEmployerRate = Number(dto.pfEmployerRate);
    if (dto.pfWageCeiling !== undefined)
      next.pfWageCeiling = Number(dto.pfWageCeiling);
    if (dto.pfApplyWageCap !== undefined)
      next.pfApplyWageCap = Boolean(dto.pfApplyWageCap);
    if (dto.highPackageBasicThreshold !== undefined)
      next.highPackageBasicThreshold = Number(dto.highPackageBasicThreshold);
    if (dto.highPackagePfOptional !== undefined)
      next.highPackagePfOptional = Boolean(dto.highPackagePfOptional);
    if (dto.esiEnabled !== undefined) next.esiEnabled = Boolean(dto.esiEnabled);
    if (dto.esiEmployeeRate !== undefined)
      next.esiEmployeeRate = Number(dto.esiEmployeeRate);
    if (dto.esiEmployerRate !== undefined)
      next.esiEmployerRate = Number(dto.esiEmployerRate);
    if (dto.esiGrossCeiling !== undefined)
      next.esiGrossCeiling = Number(dto.esiGrossCeiling);
    if (dto.ptEnabled !== undefined) next.ptEnabled = Boolean(dto.ptEnabled);
    if (dto.ptState !== undefined) next.ptState = String(dto.ptState);
    if (dto.ptSlabs !== undefined)
      next.ptSlabsJson = JSON.stringify(dto.ptSlabs);
    if (dto.lwpCalculationBase !== undefined)
      next.lwpCalculationBase = String(dto.lwpCalculationBase);
    if (dto.defaultConveyanceEmployee !== undefined)
      next.defaultConveyanceEmployee = Number(dto.defaultConveyanceEmployee);
    if (dto.defaultConveyanceIntern !== undefined)
      next.defaultConveyanceIntern = Number(dto.defaultConveyanceIntern);
    if (dto.defaultConveyanceContract !== undefined)
      next.defaultConveyanceContract = Number(dto.defaultConveyanceContract);
    if (dto.defaultTaxRegime !== undefined)
      next.defaultTaxRegime = String(dto.defaultTaxRegime);
    if (dto.employmentTypeDefaults !== undefined)
      next.employmentTypeDefaultsJson = JSON.stringify(
        dto.employmentTypeDefaults,
      );

    const changedFields = CONFIG_FIELD_NAMES.filter(
      (field) => String((current as any)[field]) !== String(next[field]),
    );
    if (changedFields.length === 0) {
      throw new BadRequestException('No payroll config fields changed.');
    }

    const effectiveFrom = new Date();

    return this.prisma.$transaction(async (tx: any) => {
      await tx.payrollConfigVersion.update({
        where: { id: current.id },
        data: { isActive: false, effectiveTo: effectiveFrom },
      });

      const created = await tx.payrollConfigVersion.create({
        data: {
          organizationId,
          version: current.version + 1,
          isActive: true,
          ...next,
          effectiveFrom,
          createdBy: userId,
          changeReason: reason,
        },
      });

      await tx.payrollConfigAuditLog.createMany({
        data: changedFields.map((field) => ({
          organizationId,
          configVersionId: created.id,
          fieldName: field,
          oldValue:
            (current as any)[field] === null ||
            (current as any)[field] === undefined
              ? null
              : String((current as any)[field]),
          newValue: String(next[field]),
          changedBy: userId,
          reason,
          effectiveFrom,
        })),
      });

      return toApiShape(created);
    });
  }
}
