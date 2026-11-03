import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  annualSalaryStatement,
  bankTransfer,
  esiReturn,
  fullAndFinal,
  pfEcr,
  SlipRow,
} from './statutory-exports.policy';

/** Runs whose numbers are settled enough to pay or file from. */
const EXPORTABLE = ['APPROVED', 'FINALIZED', 'LOCKED', 'PAID'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export type ExportKind = 'bank' | 'pf-ecr' | 'esi';

function bankOf(p: any): SlipRow['bank'] {
  if (!p) return null;
  let json: any = {};
  try {
    json = p.bankDetailsJson ? JSON.parse(p.bankDetailsJson) : {};
  } catch {
    json = {};
  }
  return {
    holderName:
      p.bankHolderName ||
      json.holderName ||
      json.accountHolderName ||
      undefined,
    accountNumber: p.bankAccountNumber || json.accountNumber || undefined,
    ifscCode: p.bankIfscCode || json.ifscCode || json.ifsc || undefined,
  };
}

@Injectable()
export class StatutoryExportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async runRows(runId: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (!EXPORTABLE.includes(run.status)) {
      throw new BadRequestException(
        'Approve the payroll run before downloading bank or statutory files',
      );
    }
    const slips = await this.prisma.payslip.findMany({
      where: { payrollRunId: runId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            employeeProfile: true,
            employeeSalaries: {
              where: { status: 'ACTIVE' },
              take: 1,
              orderBy: { effectiveFrom: 'desc' },
            },
          },
        },
      },
      orderBy: { netPay: 'desc' },
    });
    const rows: SlipRow[] = slips.map((s: any) => {
      const u = s.user || {};
      const salary = u.employeeSalaries?.[0];
      return {
        employeeName:
          `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
          u.email ||
          s.userId,
        employeeCode: u.email || null,
        grossPay: s.grossPay,
        basic: s.basic,
        daAllowance: s.daAllowance,
        pfEmployee: s.pfEmployee,
        pfEmployer: s.pfEmployer,
        esiEmployee: s.esiEmployee,
        esiEmployer: s.esiEmployer,
        professionalTax: s.professionalTax,
        tds: s.tds,
        netPay: s.netPay,
        workingDays: s.workingDays,
        presentDays: s.presentDays,
        lwpDays: s.lwpDays,
        uan: salary?.pfNumber ?? null,
        esiNumber: salary?.esiNumber ?? null,
        bank: bankOf(u.employeeProfile),
      };
    });
    return { run, rows };
  }

  /** One file of a run, as { filename, content, count, problems } so the page can list who was left out. */
  async runExport(runId: string, kind: ExportKind) {
    const { run, rows } = await this.runRows(runId);
    const period = `${MONTHS[run.month - 1] || run.month}-${run.year}`;
    if (kind === 'bank') {
      const out = bankTransfer(rows, `Salary ${period}`);
      return {
        filename: `salary-bank-transfer-${period}.csv`,
        mime: 'text/csv',
        content: out.csv,
        count: out.count,
        total: out.total,
        problems: out.problems,
      };
    }
    if (kind === 'pf-ecr') {
      const out = pfEcr(rows);
      return {
        filename: `pf-ecr-${period}.txt`,
        mime: 'text/plain',
        content: out.text,
        count: out.count,
        problems: out.problems,
      };
    }
    if (kind === 'esi') {
      const out = esiReturn(rows);
      return {
        filename: `esi-contribution-${period}.csv`,
        mime: 'text/csv',
        content: out.csv,
        count: out.count,
        problems: out.problems,
      };
    }
    throw new BadRequestException('Unknown export');
  }

  /** Financial year April (fy) to March (fy+1), from approved-or-later runs only. */
  async annualStatement(userId: string, fy: number) {
    if (!Number.isInteger(fy) || fy < 2000 || fy > 2100)
      throw new BadRequestException(
        'Give the financial year start, for example 2026 for FY 2026-27',
      );
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        employeeProfile: { select: { panNumber: true } },
      },
    });
    if (!user) throw new NotFoundException('Employee not found');
    const slips = await this.prisma.payslip.findMany({
      where: {
        userId,
        payrollRun: {
          status: { in: EXPORTABLE as any },
          OR: [
            { year: fy, month: { gte: 4 } },
            { year: fy + 1, month: { lte: 3 } },
          ],
        },
      },
      include: { payrollRun: { select: { month: true, year: true } } },
    });
    const rows = slips
      .map((s: any) => ({
        ...s,
        month: s.payrollRun.month,
        year: s.payrollRun.year,
      }))
      .sort((a, b) => a.year - b.year || a.month - b.month);
    return {
      employee: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
        pan: user.employeeProfile?.panNumber || null,
      },
      financialYear: `${fy}-${String((fy + 1) % 100).padStart(2, '0')}`,
      ...annualSalaryStatement(rows),
    };
  }

  /** Full & final for an employee who has an exit date; nothing is saved until HR marks it settled. */
  async fullAndFinal(
    userId: string,
    dto: {
      lastWorkingDay?: string;
      noticeShortfallDays?: number;
      otherRecoveries?: number;
      otherPayments?: number;
      markSettled?: boolean;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        employeeProfile: true,
        employeeSalaries: {
          where: { status: 'ACTIVE' },
          take: 1,
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });
    if (!user) throw new NotFoundException('Employee not found');
    const profile: any = user.employeeProfile;
    const salary: any = user.employeeSalaries?.[0];
    if (!profile?.joiningDate)
      throw new BadRequestException(
        'Joining date is missing on the employee profile',
      );
    if (!salary)
      throw new BadRequestException(
        'No active salary structure for this employee',
      );
    const lwdRaw = dto.lastWorkingDay || profile.exitDate;
    const lastWorkingDay = lwdRaw ? new Date(lwdRaw) : null;
    if (!lastWorkingDay || Number.isNaN(lastWorkingDay.getTime()))
      throw new BadRequestException(
        'Set the last working day (exit date) first',
      );
    if (lastWorkingDay < profile.joiningDate)
      throw new BadRequestException(
        'Last working day is before the joining date',
      );

    const el = await this.prisma.leaveBalance.findFirst({
      where: { userId, leaveType: 'EARNED', cycle: { isCurrent: true } },
    });
    const monthlyBasic = Number(salary.basicSalary) || 0;
    const monthlyGross =
      monthlyBasic +
      [
        'hra',
        'conveyanceAllowance',
        'specialAllowance',
        'performanceIncentive',
        'daAllowance',
        'otherAllowance',
      ].reduce((s, k) => s + (Number(salary[k]) || 0), 0);
    const settlement = fullAndFinal({
      joiningDate: new Date(profile.joiningDate),
      lastWorkingDay,
      monthlyGross,
      monthlyBasic,
      earnedLeaveBalance: el ? Number(el.available) : 0,
      noticeShortfallDays: Number(dto.noticeShortfallDays) || 0,
      otherRecoveries: Number(dto.otherRecoveries) || 0,
      otherPayments: Number(dto.otherPayments) || 0,
    });
    if (dto.markSettled) {
      await this.prisma.employeeProfile.update({
        where: { userId },
        data: { ffSettled: true, exitDate: lastWorkingDay },
      });
    }
    return {
      employee: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
      },
      joiningDate: profile.joiningDate,
      lastWorkingDay,
      monthlyGross,
      monthlyBasic,
      earnedLeaveBalance: el ? Number(el.available) : null,
      settled: !!dto.markSettled || !!profile.ffSettled,
      ...settlement,
    };
  }
}
