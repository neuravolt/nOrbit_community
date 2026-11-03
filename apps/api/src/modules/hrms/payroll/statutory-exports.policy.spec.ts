import {
  annualSalaryStatement,
  bankTransfer,
  esiReturn,
  fullAndFinal,
  pfEcr,
  SlipRow,
  toCsv,
} from './statutory-exports.policy';

const row = (over: Partial<SlipRow> = {}): SlipRow => ({
  employeeName: 'Asha Rao',
  employeeCode: 'asha@x.in',
  grossPay: 48600,
  basic: 15000,
  pfEmployee: 1800,
  pfEmployer: 1800,
  esiEmployee: 0,
  esiEmployer: 0,
  professionalTax: 200,
  tds: 0,
  netPay: 46600,
  workingDays: 22,
  presentDays: 22,
  lwpDays: 0,
  uan: '100200300400',
  esiNumber: null,
  bank: {
    holderName: 'ASHA RAO',
    accountNumber: '1234567890',
    ifscCode: 'HDFC0001234',
  },
  ...over,
});

describe('statutory exports', () => {
  it('quotes CSV cells that need it', () => {
    expect(toCsv([['a,b', 'say "hi"', 3]])).toBe('"a,b","say ""hi""",3\n');
  });

  it('bank sheet pays valid rows and lists the rest', () => {
    const out = bankTransfer(
      [
        row(),
        row({ employeeName: 'No Bank', bank: null }),
        row({
          employeeName: 'Bad IFSC',
          bank: { accountNumber: '1234567', ifscCode: 'HDFC1234' },
        }),
        row({ netPay: 0 }),
      ],
      'Salary Sep-2026',
    );
    expect(out.count).toBe(1);
    expect(out.total).toBe(46600);
    expect(out.csv).toContain(
      'ASHA RAO,1234567890,HDFC0001234,46600,Salary Sep-2026,asha@x.in',
    );
    expect(out.problems.map((p) => p.employee)).toEqual([
      'No Bank',
      'Bad IFSC',
    ]);
  });

  it('PF ECR splits EPS at the 15,000 ceiling and puts the rest in the ER difference', () => {
    const out = pfEcr([
      row(),
      row({ employeeName: 'No UAN', uan: '12' }),
      row({ employeeName: 'No PF', pfEmployee: 0 }),
    ]);
    expect(out.count).toBe(1);
    expect(out.text.trim()).toBe(
      [
        '100200300400',
        'ASHA RAO',
        48600,
        15000,
        15000,
        15000,
        1800,
        1250,
        550,
        0,
        0,
      ].join('#~#'),
    );
    expect(out.problems).toEqual([
      { employee: 'No UAN', reason: 'UAN missing or not 12 digits' },
    ]);
  });

  it('ESI lists only covered employees with paid days', () => {
    const out = esiReturn([
      row({
        esiEmployee: 150,
        grossPay: 20000,
        esiNumber: '1234567890',
        lwpDays: 2,
      }),
      row(),
    ]);
    expect(out.count).toBe(1);
    expect(out.csv.split('\n')[1]).toBe('1234567890,Asha Rao,20,20000,,');
  });

  it('annual statement adds up the year', () => {
    const s = annualSalaryStatement([
      {
        month: 4,
        year: 2026,
        grossPay: 50000,
        basic: 20000,
        hra: 10000,
        pfEmployee: 1800,
        professionalTax: 200,
        tds: 1000,
        netPay: 47000,
      },
      {
        month: 5,
        year: 2026,
        grossPay: 50000,
        basic: 20000,
        hra: 10000,
        pfEmployee: 1800,
        professionalTax: 200,
        tds: 1000,
        netPay: 47000,
      },
    ]);
    expect(s).toMatchObject({
      months: 2,
      grossSalary: 100000,
      tdsDeducted: 2000,
      netPaid: 94000,
      employeePf: 3600,
    });
  });

  it('full & final: pro-rata month, leave encashment, notice recovery, no gratuity under 5 years', () => {
    const f = fullAndFinal({
      joiningDate: new Date('2024-01-01'),
      lastWorkingDay: new Date('2026-09-15'),
      monthlyGross: 30000,
      monthlyBasic: 13000,
      earnedLeaveBalance: 10,
      noticeShortfallDays: 5,
    });
    expect(f.earnings.finalMonthSalary).toBe(15000);
    expect(f.earnings.leaveEncashment).toBe(5000);
    expect(f.earnings.gratuity).toBe(0);
    expect(f.recoveries.noticeRecovery).toBe(5000);
    expect(f.netSettlement).toBe(15000);
  });

  it('full & final: gratuity after 5 years, 6+ months rounds up', () => {
    const f = fullAndFinal({
      joiningDate: new Date('2020-01-01'),
      lastWorkingDay: new Date('2026-09-30'),
      monthlyGross: 52000,
      monthlyBasic: 26000,
      earnedLeaveBalance: 0,
    });
    expect(f.gratuityEligible).toBe(true);
    expect(f.earnings.gratuity).toBe(105000); // 15/26 × 26000 × 7
  });
});
