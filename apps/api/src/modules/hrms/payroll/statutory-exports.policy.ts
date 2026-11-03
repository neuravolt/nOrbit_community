/**
 * Statutory and bank outputs of a payroll run, and the full & final settlement, as plain data.
 * Formats follow what Indian payroll teams upload: a bank bulk-transfer sheet, the EPFO ECR text
 * file (#~# separated) and the ESIC monthly contribution sheet.
 */
export interface SlipRow {
  employeeName: string;
  employeeCode?: string | null;
  grossPay: number;
  basic: number;
  daAllowance?: number | null;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  tds: number;
  netPay: number;
  workingDays: number;
  presentDays: number;
  lwpDays: number;
  uan?: string | null;
  esiNumber?: string | null;
  bank?: {
    holderName?: string;
    accountNumber?: string;
    ifscCode?: string;
  } | null;
}

const money = (n: unknown) => Math.round(Number(n) || 0);
const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: unknown[][]) =>
  rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Bank bulk-transfer sheet: one row per employee to pay, and a list of who cannot be paid and why. */
export function bankTransfer(rows: SlipRow[], narration: string) {
  const ok: unknown[][] = [
    [
      'Beneficiary name',
      'Account number',
      'IFSC',
      'Amount',
      'Narration',
      'Employee',
    ],
  ];
  const problems: { employee: string; reason: string }[] = [];
  for (const r of rows) {
    const acct = String(r.bank?.accountNumber || '').replace(/\s/g, '');
    const ifsc = String(r.bank?.ifscCode || '')
      .toUpperCase()
      .trim();
    if (money(r.netPay) <= 0) continue;
    if (!/^\d{6,18}$/.test(acct)) {
      problems.push({
        employee: r.employeeName,
        reason: 'Bank account number missing or not valid',
      });
      continue;
    }
    if (!IFSC.test(ifsc)) {
      problems.push({
        employee: r.employeeName,
        reason: 'IFSC code missing or not valid',
      });
      continue;
    }
    ok.push([
      r.bank?.holderName || r.employeeName,
      acct,
      ifsc,
      money(r.netPay),
      narration,
      r.employeeCode || r.employeeName,
    ]);
  }
  const total = ok.slice(1).reduce((s, r) => s + Number(r[3]), 0);
  return { csv: toCsv(ok), count: ok.length - 1, total, problems };
}

export const EPS_WAGE_CEILING = 15000;

/**
 * EPFO ECR (electronic challan cum return) lines:
 * UAN#~#Name#~#Gross wages#~#EPF wages#~#EPS wages#~#EDLI wages#~#EE share#~#EPS share#~#ER-EPS difference#~#NCP days#~#Refund
 * EPF wages are what the 12% employee share was worked on; EPS/EDLI wages are capped at 15,000.
 */
export function pfEcr(rows: SlipRow[]) {
  const lines: string[] = [];
  const problems: { employee: string; reason: string }[] = [];
  for (const r of rows) {
    const ee = money(r.pfEmployee);
    if (ee <= 0) continue; // not a PF member this month
    const uan = String(r.uan || '').replace(/\s/g, '');
    if (!/^\d{12}$/.test(uan)) {
      problems.push({
        employee: r.employeeName,
        reason: 'UAN missing or not 12 digits',
      });
      continue;
    }
    const epfWages = money(ee / 0.12);
    const epsWages = Math.min(epfWages, EPS_WAGE_CEILING);
    const eps = money(epsWages * 0.0833);
    const erTotal = money(r.pfEmployer) || money(epfWages * 0.12);
    const diff = Math.max(0, erTotal - eps);
    lines.push(
      [
        uan,
        r.employeeName.toUpperCase(),
        money(r.grossPay),
        epfWages,
        epsWages,
        epsWages,
        ee,
        eps,
        diff,
        Math.round(Number(r.lwpDays) || 0),
        0,
      ].join('#~#'),
    );
  }
  return {
    text: lines.join('\n') + (lines.length ? '\n' : ''),
    count: lines.length,
    problems,
  };
}

/** ESIC monthly contribution sheet: IP number, name, days paid, wages. */
export function esiReturn(rows: SlipRow[]) {
  const out: unknown[][] = [
    [
      'IP Number',
      'IP Name',
      'No of days for which wages paid',
      'Total monthly wages',
      'Reason code for zero working days',
      'Last working day',
    ],
  ];
  const problems: { employee: string; reason: string }[] = [];
  for (const r of rows) {
    if (money(r.esiEmployee) <= 0) continue;
    const ip = String(r.esiNumber || '').replace(/\s/g, '');
    if (!/^\d{10}$/.test(ip)) {
      problems.push({
        employee: r.employeeName,
        reason: 'ESI IP number missing or not 10 digits',
      });
      continue;
    }
    const days = Math.max(
      0,
      Math.round((Number(r.workingDays) || 0) - (Number(r.lwpDays) || 0)),
    );
    out.push([
      ip,
      r.employeeName,
      days,
      money(r.grossPay),
      days === 0 ? 1 : '',
      '',
    ]);
  }
  return { csv: toCsv(out), count: out.length - 1, problems };
}

/** Form 16 Part B style yearly statement from the year's payslips (Part A comes from TRACES). */
export function annualSalaryStatement(
  slips: {
    month: number;
    year: number;
    grossPay: number;
    basic: number;
    hra: number;
    pfEmployee: number;
    professionalTax: number;
    tds: number;
    netPay: number;
  }[],
) {
  const sum = (k: keyof (typeof slips)[number]) =>
    slips.reduce((s, x) => s + money(x[k]), 0);
  return {
    months: slips.length,
    grossSalary: sum('grossPay'),
    basic: sum('basic'),
    hra: sum('hra'),
    employeePf: sum('pfEmployee'),
    professionalTax: sum('professionalTax'),
    tdsDeducted: sum('tds'),
    netPaid: sum('netPay'),
    byMonth: slips.map((x) => ({
      month: x.month,
      year: x.year,
      gross: money(x.grossPay),
      tds: money(x.tds),
      net: money(x.netPay),
    })),
  };
}

export const GRATUITY_CAP = 2_000_000;

/**
 * Full & final settlement. Salary for the days worked in the last month, unused earned leave paid
 * out at basic/26 a day, gratuity after 5 years (15/26 of last basic per year, rounded to whole
 * years: 6 months or more counts as a year, capped at 20 lakh), less notice-period shortfall
 * (gross/30 a day) and any other recovery HR enters.
 */
export function fullAndFinal(opts: {
  joiningDate: Date;
  lastWorkingDay: Date;
  monthlyGross: number;
  monthlyBasic: number;
  earnedLeaveBalance: number;
  noticeShortfallDays?: number;
  otherRecoveries?: number;
  otherPayments?: number;
}) {
  const lwd = opts.lastWorkingDay;
  const daysInMonth = new Date(
    Date.UTC(lwd.getUTCFullYear(), lwd.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const daysWorked = lwd.getUTCDate();
  const finalMonthSalary = money(
    (opts.monthlyGross / daysInMonth) * daysWorked,
  );
  const leaveEncashment = money(
    Math.max(0, opts.earnedLeaveBalance) * (opts.monthlyBasic / 26),
  );
  const serviceMs = lwd.getTime() - opts.joiningDate.getTime();
  const serviceYearsExact = serviceMs / (365.25 * 86_400_000);
  const serviceYears =
    Math.floor(serviceYearsExact) + (serviceYearsExact % 1 >= 0.5 ? 1 : 0);
  const gratuity =
    serviceYearsExact >= 5
      ? Math.min(
          GRATUITY_CAP,
          money((15 / 26) * opts.monthlyBasic * serviceYears),
        )
      : 0;
  const noticeRecovery = money(
    Math.max(0, opts.noticeShortfallDays || 0) * (opts.monthlyGross / 30),
  );
  const otherRecoveries = money(opts.otherRecoveries);
  const otherPayments = money(opts.otherPayments);
  const payable = finalMonthSalary + leaveEncashment + gratuity + otherPayments;
  const recoveries = noticeRecovery + otherRecoveries;
  return {
    daysWorked,
    daysInMonth,
    serviceYears: Math.round(serviceYearsExact * 10) / 10,
    earnings: { finalMonthSalary, leaveEncashment, gratuity, otherPayments },
    recoveries: { noticeRecovery, otherRecoveries },
    netSettlement: payable - recoveries,
    gratuityEligible: serviceYearsExact >= 5,
  };
}
