import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

// Section 2 (gap-closure pass) — one shared, append-only audit trail for
// every mutable payroll entity: components, holiday calendars/holidays/
// assignments, working week, tax config, adjustments, and employee
// overrides. `recordDiff` writes one row per changed field (mirroring
// PayrollConfigAuditLog's existing pattern); `recordAction` writes one row
// for a wholesale action that isn't a field-by-field edit (CREATE, DELETE,
// ASSIGN, APPROVE, REJECT).

export type PayrollAuditEntityType =
  | 'SALARY_COMPONENT'
  | 'EMPLOYEE_SALARY_COMPONENT'
  | 'HOLIDAY_CALENDAR'
  | 'HOLIDAY'
  | 'HOLIDAY_ASSIGNMENT'
  | 'WORKING_WEEK'
  | 'TAX_REGIME_CONFIG'
  | 'PAYROLL_ADJUSTMENT'
  | 'EMPLOYEE_OVERRIDE';

export type PayrollAuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DEACTIVATE'
  | 'DELETE'
  | 'ASSIGN'
  | 'APPROVE'
  | 'REJECT';

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

@Injectable()
export class PayrollAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async recordAction(
    organizationId: string,
    entityType: PayrollAuditEntityType,
    entityId: string,
    action: PayrollAuditAction,
    actorId: string,
    reason?: string,
    snapshot?: Record<string, any>,
  ) {
    return this.prisma.payrollAuditLog.create({
      data: {
        organizationId,
        entityType: entityType as any,
        entityId,
        action: action as any,
        actorId,
        reason,
        newValue: snapshot ? JSON.stringify(snapshot) : undefined,
      },
    });
  }

  // Diffs `before` vs `after` on the given field list and writes one
  // append-only row per field that actually changed. Fields not present in
  // `fields` are ignored even if present on the objects (callers pass the
  // exact set of user-editable fields, not internal bookkeeping like
  // `updatedAt`).
  async recordDiff(
    organizationId: string,
    entityType: PayrollAuditEntityType,
    entityId: string,
    actorId: string,
    reason: string | undefined,
    before: Record<string, any>,
    after: Record<string, any>,
    fields: string[],
  ) {
    const rows = fields
      .filter((field) => stringify(before[field]) !== stringify(after[field]))
      .map((field) => ({
        organizationId,
        entityType: entityType as any,
        entityId,
        action: 'UPDATE' as any,
        fieldName: field,
        oldValue: stringify(before[field]),
        newValue: stringify(after[field]),
        actorId,
        reason,
      }));
    if (rows.length === 0) return [];
    await this.prisma.payrollAuditLog.createMany({ data: rows });
    return rows;
  }

  async history(
    organizationId: string,
    entityType: PayrollAuditEntityType,
    entityId: string,
  ) {
    return this.prisma.payrollAuditLog.findMany({
      where: { organizationId, entityType: entityType as any, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // General browse view for the admin audit-history screen — filterable by
  // entity type, action, actor, and date range, since a flat "show
  // everything" list isn't useful once an org has any real history.
  async listAll(
    organizationId: string,
    filters: {
      entityType?: PayrollAuditEntityType;
      action?: PayrollAuditAction;
      actorId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
    limit = 100,
  ) {
    return this.prisma.payrollAuditLog.findMany({
      where: {
        organizationId,
        ...(filters.entityType
          ? { entityType: filters.entityType as any }
          : {}),
        ...(filters.action ? { action: filters.action as any } : {}),
        ...(filters.actorId ? { actorId: filters.actorId } : {}),
        ...(filters.dateFrom || filters.dateTo
          ? {
              createdAt: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }
}
