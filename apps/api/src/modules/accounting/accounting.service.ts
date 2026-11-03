import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Purchase Register ──────────────────────────────────────────────────────

  async listPurchases(query: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { page = 1, limit = 20, search } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (search) {
      where.OR = [
        { vendor: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { invoiceNo: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [entries, total] = await Promise.all([
      this.prisma.purchaseEntry.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { date: 'desc' },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.purchaseEntry.count({ where }),
    ]);
    return { entries, total, page: Number(page), limit: Number(limit) };
  }

  async createPurchase(dto: any, userId: string) {
    const totalAmount = Number(dto.amount) + Number(dto.gstAmount || 0);
    return this.prisma.purchaseEntry.create({
      data: {
        ...dto,
        totalAmount,
        createdById: userId,
        date: new Date(dto.date),
      },
    });
  }

  async updatePurchase(id: string, dto: any) {
    await this.prisma.purchaseEntry.findUniqueOrThrow({ where: { id } });
    const totalAmount =
      dto.amount != null
        ? Number(dto.amount) + Number(dto.gstAmount || 0)
        : undefined;
    return this.prisma.purchaseEntry.update({
      where: { id },
      data: {
        ...dto,
        ...(totalAmount != null && { totalAmount }),
        ...(dto.date && { date: new Date(dto.date) }),
      },
    });
  }

  async deletePurchase(id: string) {
    await this.prisma.purchaseEntry.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  // ─── Expense Register ───────────────────────────────────────────────────────

  async listExpenses(query: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
  }) {
    const { page = 1, limit = 20, search, category } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (search) where.description = { contains: search, mode: 'insensitive' };
    if (category) where.category = category;
    const [entries, total] = await Promise.all([
      this.prisma.expenseEntry.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { date: 'desc' },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.expenseEntry.count({ where }),
    ]);
    return { entries, total, page: Number(page), limit: Number(limit) };
  }

  async createExpense(dto: any, userId: string) {
    return this.prisma.expenseEntry.create({
      data: { ...dto, createdById: userId, date: new Date(dto.date) },
    });
  }

  async updateExpense(id: string, dto: any) {
    await this.prisma.expenseEntry.findUniqueOrThrow({ where: { id } });
    return this.prisma.expenseEntry.update({
      where: { id },
      data: { ...dto, ...(dto.date && { date: new Date(dto.date) }) },
    });
  }

  async deleteExpense(id: string) {
    await this.prisma.expenseEntry.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  // ─── Bank Book ──────────────────────────────────────────────────────────────

  async listBankTransactions(query: {
    page?: number;
    limit?: number;
    bankName?: string;
  }) {
    const { page = 1, limit = 20, bankName } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (bankName) where.bankName = { contains: bankName, mode: 'insensitive' };
    const [entries, total] = await Promise.all([
      this.prisma.bankTransaction.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { date: 'desc' },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.bankTransaction.count({ where }),
    ]);
    return { entries, total, page: Number(page), limit: Number(limit) };
  }

  async createBankTransaction(dto: any, userId: string) {
    return this.prisma.bankTransaction.create({
      data: { ...dto, createdById: userId, date: new Date(dto.date) },
    });
  }

  async updateBankTransaction(id: string, dto: any) {
    await this.prisma.bankTransaction.findUniqueOrThrow({ where: { id } });
    return this.prisma.bankTransaction.update({
      where: { id },
      data: { ...dto, ...(dto.date && { date: new Date(dto.date) }) },
    });
  }

  async deleteBankTransaction(id: string) {
    await this.prisma.bankTransaction.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  // ─── Cash Book ──────────────────────────────────────────────────────────────

  async listCashTransactions(query: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      this.prisma.cashTransaction.findMany({
        skip,
        take: Number(limit),
        orderBy: { date: 'desc' },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.cashTransaction.count(),
    ]);
    return { entries, total, page: Number(page), limit: Number(limit) };
  }

  async createCashTransaction(dto: any, userId: string) {
    return this.prisma.cashTransaction.create({
      data: { ...dto, createdById: userId, date: new Date(dto.date) },
    });
  }

  async updateCashTransaction(id: string, dto: any) {
    await this.prisma.cashTransaction.findUniqueOrThrow({ where: { id } });
    return this.prisma.cashTransaction.update({
      where: { id },
      data: { ...dto, ...(dto.date && { date: new Date(dto.date) }) },
    });
  }

  async deleteCashTransaction(id: string) {
    await this.prisma.cashTransaction.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  // ─── Salary Register ────────────────────────────────────────────────────────

  async listSalaries(query: {
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
  }) {
    const { month, year, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);
    const [entries, total] = await Promise.all([
      this.prisma.salaryEntry.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.salaryEntry.count({ where }),
    ]);
    return { entries, total, page: Number(page), limit: Number(limit) };
  }

  async createSalary(dto: any, createdById: string) {
    return this.prisma.salaryEntry.create({
      data: {
        ...dto,
        month: Number(dto.month),
        year: Number(dto.year),
        basicSalary: Number(dto.basicSalary),
        allowances: Number(dto.allowances || 0),
        deductions: Number(dto.deductions || 0),
        netPay:
          Number(dto.basicSalary) +
          Number(dto.allowances || 0) -
          Number(dto.deductions || 0),
        createdById,
        ...(dto.paidAt && { paidAt: new Date(dto.paidAt) }),
      },
    });
  }

  async updateSalary(id: string, dto: any) {
    await this.prisma.salaryEntry.findUniqueOrThrow({ where: { id } });
    const update: any = { ...dto };
    if (
      dto.basicSalary != null ||
      dto.allowances != null ||
      dto.deductions != null
    ) {
      const existing = await this.prisma.salaryEntry.findUnique({
        where: { id },
      });
      const basic = Number(dto.basicSalary ?? existing?.basicSalary ?? 0);
      const allow = Number(dto.allowances ?? existing?.allowances ?? 0);
      const deduct = Number(dto.deductions ?? existing?.deductions ?? 0);
      update.netPay = basic + allow - deduct;
    }
    if (dto.paidAt) update.paidAt = new Date(dto.paidAt);
    return this.prisma.salaryEntry.update({ where: { id }, data: update });
  }

  async deleteSalary(id: string) {
    await this.prisma.salaryEntry.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  // ─── Summary Dashboard ──────────────────────────────────────────────────────

  async getSummary() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalPurchases,
      monthPurchases,
      totalExpenses,
      monthExpenses,
      totalSalary,
      bankBalance,
      totalRevenue,
      monthRevenue,
    ] = await Promise.all([
      this.prisma.purchaseEntry.aggregate({ _sum: { totalAmount: true } }),
      this.prisma.purchaseEntry.aggregate({
        _sum: { totalAmount: true },
        where: { date: { gte: monthStart } },
      }),
      this.prisma.expenseEntry.aggregate({ _sum: { amount: true } }),
      this.prisma.expenseEntry.aggregate({
        _sum: { amount: true },
        where: { date: { gte: monthStart } },
      }),
      this.prisma.salaryEntry.aggregate({
        _sum: { netPay: true },
        where: { month: now.getMonth() + 1, year: now.getFullYear() },
      }),
      this.prisma.bankTransaction.groupBy({
        by: ['txType'],
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({ _sum: { amount: true } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paidAt: { gte: monthStart } },
      }),
    ]);

    const bankCredit =
      bankBalance.find((b: any) => b.txType === 'CREDIT')?._sum?.amount || 0;
    const bankDebit =
      bankBalance.find((b: any) => b.txType === 'DEBIT')?._sum?.amount || 0;

    return {
      totalRevenueAllTime: totalRevenue._sum.amount || 0,
      totalRevenueThisMonth: monthRevenue._sum.amount || 0,
      totalPurchasesAllTime: totalPurchases._sum.totalAmount || 0,
      totalPurchasesThisMonth: monthPurchases._sum.totalAmount || 0,
      totalExpensesAllTime: totalExpenses._sum.amount || 0,
      totalExpensesThisMonth: monthExpenses._sum.amount || 0,
      totalSalaryThisMonth: totalSalary._sum.netPay || 0,
      bankBalance: Number(bankCredit) - Number(bankDebit),
    };
  }
}
