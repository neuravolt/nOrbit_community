import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyProfileService } from '../../modules/company-profile/company-profile.service';

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', (date: any) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
});

Handlebars.registerHelper('formatCurrency', (amount: any) => {
  if (amount === undefined || amount === null) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});

Handlebars.registerHelper('formatNumber', (n: any) => {
  if (n === undefined || n === null) return '0';
  return Number(n).toLocaleString('en-IN');
});

Handlebars.registerHelper('formatNum', (n: any) => {
  if (n === undefined || n === null) return '0';
  return Number(n).toFixed(1);
});

Handlebars.registerHelper('formatInteger', (n: any) => {
  if (n === undefined || n === null) return '0';
  return Number(n).toLocaleString('en-IN');
});

Handlebars.registerHelper('add', (a: any, b: any) => Number(a) + Number(b));

Handlebars.registerHelper('initials', (name: any) => {
  if (!name || typeof name !== 'string') return 'AT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
});

Handlebars.registerHelper(
  'eq',
  function (this: any, a: any, b: any, options: Handlebars.HelperOptions) {
    const isEqual = a === b;
    if (options && typeof options.fn === 'function') {
      return isEqual ? options.fn(this) : options.inverse(this);
    }
    return isEqual;
  },
);

function numberToIndianWords(num: number): string {
  if (num === undefined || num === null || isNaN(num) || num === 0)
    return 'Rupees Zero Only';
  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const b = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
  }

  function convert(n: number): string {
    if (n < 100) return inWords(n);
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        ' Hundred' +
        (n % 100 ? ' ' + convert(n % 100) : '')
      );
    if (n < 100000)
      return (
        convert(Math.floor(n / 1000)) +
        ' Thousand' +
        (n % 1000 ? ' ' + convert(n % 1000) : '')
      );
    if (n < 10000000)
      return (
        convert(Math.floor(n / 100000)) +
        ' Lakh' +
        (n % 100000 ? ' ' + convert(n % 100000) : '')
      );
    return (
      convert(Math.floor(n / 10000000)) +
      ' Crore' +
      (n % 10000000 ? ' ' + convert(n % 10000000) : '')
    );
  }

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  let result = 'Rupees ' + convert(integerPart);
  if (decimalPart > 0) {
    result += ' and ' + convert(decimalPart) + ' Paise';
  }
  return result + ' Only';
}

@Injectable()
export class PdfService {
  private templates: Record<string, HandlebarsTemplateDelegate> = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyProfileService: CompanyProfileService,
  ) {
    this.loadTemplates();
  }

  private loadTemplates() {
    // Try src path first in development (watch mode), then fall back to compiled dist path
    const srcDir = path.join(
      process.cwd(),
      'src',
      'common',
      'pdf',
      'templates',
    );
    const distDir = path.join(__dirname, 'templates');
    const templateDir =
      fs.existsSync(srcDir) &&
      fs.readdirSync(srcDir).some((f) => f.endsWith('.hbs'))
        ? srcDir
        : distDir;

    for (const file of [
      'invoice',
      'quotation',
      'amc-report',
      'hr-document',
      'salary-slip',
      'career-dna-report',
    ]) {
      const filePath = path.join(templateDir, `${file}.hbs`);
      if (fs.existsSync(filePath)) {
        const source = fs.readFileSync(filePath, 'utf-8');
        this.templates[file] = Handlebars.compile(source);
      } else {
        // Try absolute path relative to repo root
        const fallback = path.join(
          process.cwd(),
          'apps',
          'api',
          'src',
          'common',
          'pdf',
          'templates',
          `${file}.hbs`,
        );
        if (fs.existsSync(fallback)) {
          const source = fs.readFileSync(fallback, 'utf-8');
          this.templates[file] = Handlebars.compile(source);
        }
      }
    }
  }

  private getFullUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const port = process.env.API_PORT || process.env.PORT || 3001;
    const base = `http://localhost:${port}`;
    return `${base}${url}`;
  }

  private getCompanyWithFullUrls(company: any) {
    if (!company) return company;
    return {
      ...company,
      logoUrl: this.getFullUrl(company.logoUrl),
      signatureUrl: this.getFullUrl(company.signatureUrl),
      stampUrl: this.getFullUrl(company.stampUrl),
    };
  }

  private async renderHtml(templateName: string, data: any): Promise<string> {
    const template = this.templates[templateName];
    if (!template) throw new Error(`Template ${templateName} not found`);
    return template(data);
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  // ── Invoice PDF ──────────────────────────────────────────────────────────

  async generateInvoicePdf(invoiceId: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
        quote: { select: { quoteNumber: true, title: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    const isSubscriptionInvoice = invoice.invoiceNumber?.startsWith('INV-SUB-');
    const company = this.getCompanyWithFullUrls(
      await this.companyProfileService.get(
        isSubscriptionInvoice ? null : invoice.organizationId,
      ),
    );
    const latestPayment =
      invoice.payments && invoice.payments.length > 0
        ? invoice.payments[0]
        : null;
    const isPaid = invoice.status === 'paid' || Number(invoice.balanceDue) <= 0;
    const html = await this.renderHtml('invoice', {
      invoice,
      company,
      latestPayment,
      isPaid,
    });
    return this.htmlToPdf(html);
  }

  // ── Quotation PDF ─────────────────────────────────────────────────────────

  async generateQuotationPdf(quoteId: string): Promise<Buffer> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        client: true,
        lineItems: {
          include: { service: { select: { name: true, serviceCode: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!quote) throw new NotFoundException(`Quote ${quoteId} not found`);
    const company = this.getCompanyWithFullUrls(
      await this.companyProfileService.get(quote.organizationId),
    );
    const html = await this.renderHtml('quotation', { quote, company });
    return this.htmlToPdf(html);
  }

  // ── AMC Report PDF ───────────────────────────────────────────────────────

  async generateAmcReportPdf(reportId: string): Promise<Buffer> {
    const report = await this.prisma.amcWeeklyReport.findUnique({
      where: { id: reportId },
      include: {
        compiledBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        contract: {
          include: {
            client: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });
    if (!report)
      throw new NotFoundException(`AMC report ${reportId} not found`);

    // Parse and normalize scopeExecuted and monitoringData
    let scopeExecuted: any = report.scopeExecuted;
    if (typeof scopeExecuted === 'string') {
      try {
        scopeExecuted = JSON.parse(scopeExecuted);
      } catch {
        scopeExecuted = {};
      }
    }
    let completedList: any[] = [];
    let inReviewList: any[] = [];
    let inProgressList: any[] = [];
    let backlogList: any[] = [];

    if (Array.isArray(scopeExecuted)) {
      completedList = scopeExecuted.filter((i: any) =>
        ['DONE', 'RESOLVED', 'Completed'].includes(i.status || i.statusCode),
      );
      inReviewList = scopeExecuted.filter((i: any) =>
        ['REVIEW', 'In Review'].includes(i.status || i.statusCode),
      );
      inProgressList = scopeExecuted.filter((i: any) =>
        ['IN_PROGRESS', 'In Progress'].includes(i.status || i.statusCode),
      );
      backlogList = scopeExecuted.filter((i: any) =>
        ['TODO', 'BACKLOG', 'Backlog', 'OPEN'].includes(
          i.status || i.statusCode,
        ),
      );
    } else if (scopeExecuted && typeof scopeExecuted === 'object') {
      completedList =
        scopeExecuted.completedDeliverables || scopeExecuted.completed || [];
      inReviewList = scopeExecuted.inReview || [];
      inProgressList =
        scopeExecuted.ongoingWork || scopeExecuted.inProgress || [];
      backlogList =
        scopeExecuted.upcomingPriorities || scopeExecuted.backlog || [];
    }

    const normalizeItem = (item: any) => ({
      ...item,
      assignee: item.assignee || item.assignedTo || 'Assigned Team',
      assignedTo: item.assignedTo || item.assignee || 'Assigned Team',
    });

    const normCompleted = completedList.map(normalizeItem);
    const normInReview = inReviewList.map(normalizeItem);
    const normInProgress = inProgressList.map(normalizeItem);
    const normBacklog = backlogList.map(normalizeItem);

    scopeExecuted = {
      completed: normCompleted,
      completedDeliverables: normCompleted,
      inReview: normInReview,
      inProgress: normInProgress,
      ongoingWork: normInProgress,
      backlog: normBacklog,
      upcomingPriorities: normBacklog,
      overview: {
        completed: normCompleted.length,
        inReview: normInReview.length,
        inProgress: normInProgress.length,
        backlog: normBacklog.length,
      },
    };

    let monitoringData: any = report.monitoringData;
    if (typeof monitoringData === 'string') {
      try {
        monitoringData = JSON.parse(monitoringData);
      } catch {
        monitoringData = {};
      }
    }

    const company = this.getCompanyWithFullUrls(
      await this.companyProfileService.get(report.contract?.organizationId),
    );

    const reportData = {
      ...report,
      scopeExecuted,
      monitoringData,
      itemsCompleted: normCompleted.length,
      itemsInReview: normInReview.length,
      itemsInProgress: normInProgress.length,
      itemsBacklog: normBacklog.length,
    };

    const html = await this.renderHtml('amc-report', {
      report: reportData,
      company,
    });
    return this.htmlToPdf(html);
  }

  // ── HR Document PDF ───────────────────────────────────────────────────────

  async generateHrDocumentPdf(
    docId: string,
    metadata: { content: string },
  ): Promise<Buffer> {
    const doc = await this.prisma.hrDocument.findUnique({
      where: { id: docId },
      include: { employee: true },
    });
    if (!doc) throw new NotFoundException(`HR Document ${docId} not found`);

    const company = this.getCompanyWithFullUrls(
      await this.companyProfileService.get(doc.employee?.organizationId),
    );

    const html = await this.renderHtml('hr-document', {
      id: doc.id,
      title: doc.title,
      date: doc.createdAt,
      employee: doc.employee,
      content: metadata.content || doc.notes || '',
      company,
    });
    return this.htmlToPdf(html);
  }

  async generateSalarySlipPdf(
    salaryEntryId: string,
    overrides?: any,
  ): Promise<Buffer> {
    const entry = await this.prisma.salaryEntry.findUnique({
      where: { id: salaryEntryId },
      include: {
        employee: {
          include: {
            employeeProfile: {
              include: {
                department: true,
                designation: true,
              },
            },
          },
        },
      },
    });
    if (!entry)
      throw new NotFoundException(`Salary Entry ${salaryEntryId} not found`);

    const rawCompany = await this.companyProfileService.get(entry.employee?.organizationId);
    const company = this.getCompanyWithFullUrls(rawCompany);
    const legalName =
      company?.legalName || company?.companyName || 'VOLTNOVATE SOLUTIONS LLP';

    const MONTHS = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthName = MONTHS[entry.month - 1] || 'Month';

    const basicSalary = overrides?.basicSalary ?? (entry.basicSalary || 0);
    const totalAllowances = overrides?.allowances ?? (entry.allowances || 0);
    const totalDeductions = overrides?.deductions ?? (entry.deductions || 0);

    const da = overrides?.da ?? 0;
    const hra = overrides?.hra ?? 0;
    const conveyance = overrides?.conveyance ?? 0;
    const specialAllowance = overrides?.specialAllowance ?? 0;
    const performanceIncentive = overrides?.performanceIncentive ?? 0;

    const grossEarnings =
      overrides?.hra != null
        ? basicSalary +
          da +
          hra +
          conveyance +
          specialAllowance +
          performanceIncentive
        : basicSalary + totalAllowances;

    // Deductions breakdown
    const pf = overrides?.pf ?? 0;
    const esi = overrides?.esi ?? 0;
    const professionalTax = overrides?.professionalTax ?? 0;
    const tds = overrides?.tds ?? 0;
    const gis = overrides?.gis ?? 0;
    const npsEmployee = overrides?.npsEmployee ?? 0;
    const npsGovt = overrides?.npsGovt ?? 0;
    const otherDeductions = overrides?.otherDeductions ?? 0;

    const calculatedDeductions =
      overrides?.pf != null
        ? pf + esi + professionalTax + tds + gis + npsEmployee + otherDeductions
        : totalDeductions;

    const netSalary = grossEarnings - calculatedDeductions;

    const emp = entry.employee;
    const empName = emp
      ? `${emp.firstName} ${emp.lastName}`
      : entry.employeeName || 'Employee';
    const empId = emp ? `EMP${emp.id.slice(0, 4).toUpperCase()}` : '—';
    const designation =
      emp?.employeeProfile?.designation?.name || emp?.role || '—';
    const department = emp?.employeeProfile?.department?.name || '—';
    const joiningDate = emp?.employeeProfile?.joiningDate
      ? new Date(emp.employeeProfile.joiningDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';
    const dob = emp?.employeeProfile?.dateOfBirth
      ? new Date(emp.employeeProfile.dateOfBirth).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';

    const profile = emp?.employeeProfile;
    let pan = profile?.panNumber || '';
    let bankAccount =
      overrides?.bankAccount || profile?.bankAccountNumber || '';

    if (profile && !pan) {
      if (profile.governmentIdsJson) {
        try {
          const gov = JSON.parse(profile.governmentIdsJson);
          if (gov && gov.pan) pan = gov.pan;
        } catch (e) {}
      }
    }
    if (profile && !bankAccount) {
      if (profile.bankDetailsJson) {
        try {
          const bank = JSON.parse(profile.bankDetailsJson);
          if (bank && bank.accountNumber) bankAccount = bank.accountNumber;
        } catch (e) {}
      }
    }

    if (!pan) pan = '—';
    if (!bankAccount) bankAccount = '—';

    const payDateStr = entry.paidAt
      ? new Date(entry.paidAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : `31 ${monthName} ${entry.year}`;

    const voucherNo =
      overrides?.voucherNo ||
      `040/2202/052026-27/${salaryEntryId.slice(0, 4).toUpperCase()}`;
    const voucherDate = overrides?.voucherDate || payDateStr;
    const voucherGross = overrides?.voucherGross ?? null;
    const voucherNet = overrides?.voucherNet ?? null;
    const workingDays = overrides?.workingDays ?? null;
    const pran = overrides?.pran || profile?.pranNumber || '—';

    const html = await this.renderHtml('salary-slip', {
      legalName,
      monthName,
      year: entry.year,
      employee: {
        name: empName,
        empId,
        designation,
        department,
        joiningDate,
        dob,
        pan,
        bankAccount,
        pran,
        voucherNo,
        voucherDate,
        workingDays,
      },
      basicSalary,
      da,
      hra,
      conveyance,
      specialAllowance,
      performanceIncentive,
      grossEarnings,
      pf,
      esi,
      professionalTax,
      tds,
      gis,
      npsEmployee,
      npsGovt,
      otherDeductions,
      totalDeductions: calculatedDeductions,
      netSalary,
      netSalaryInWords: numberToIndianWords(netSalary),
      paymentMode:
        overrides?.paymentMode || entry.paymentMode || 'Bank Transfer',
      payDate: payDateStr,
      voucherGross,
      voucherNet,
      company,
    });
    return this.htmlToPdf(html);
  }

  // ── Career DNA Report PDF ────────────────────────────────────────────────

  async generateCareerDnaReportPdf(studentId: string): Promise<Buffer> {
    const student = await this.prisma.launchpadStudent.findUnique({
      where: { id: studentId },
      include: { track: true },
    });
    if (!student) throw new NotFoundException(`Student ${studentId} not found`);

    const careerProfile = await this.prisma.launchpadCareerProfile.findUnique({
      where: { studentId },
      include: { primaryRole: true },
    });

    const careerDna: any = careerProfile?.careerDna || {};
    const whoYouAre = careerDna.whoYouAre || {};
    const whatYouAreGoodAt = careerDna.whatYouAreGoodAt || {};
    const categoryScores: Record<string, number> =
      careerDna.categoryScores || {};

    const strandNames =
      Object.keys(categoryScores).length > 0
        ? Object.keys(categoryScores)
        : [
            'Technical Mastery',
            'Execution Focus',
            'Problem Solving',
            'Collaborative Sync',
          ];
    const strands = strandNames.map((name) => ({
      name,
      score: Math.round(categoryScores[name] || 0),
    }));

    const company = this.getCompanyWithFullUrls(
      await this.companyProfileService.get(),
    );

    const html = await this.renderHtml('career-dna-report', {
      fullName: student.fullName,
      level: student.level,
      totalPoints: student.totalPoints,
      trackName:
        careerProfile?.primaryRole?.displayName ||
        student.track?.displayName ||
        'Unassigned',
      archetype: whoYouAre.archetype || 'Pragmatic Explorer',
      learningStyle: whoYouAre.learningStyle || 'Adaptive',
      workStyle: whoYouAre.workStyle || 'Balanced',
      strengths: whatYouAreGoodAt.strengths || [],
      gaps: whatYouAreGoodAt.gaps || [],
      strands,
      generatedAt: new Date(),
      company,
    });
    return this.htmlToPdf(html);
  }
}
