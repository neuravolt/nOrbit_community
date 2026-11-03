import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PayrollConfigService } from './services/payroll-config.service';
import {
  calculatePf,
  calculateEsi,
  calculatePt,
} from './payroll/statutory-calculator';

const parseOptionalDate = (val: any): Date | null | undefined => {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const parseCreateDate = (val: any): Date | undefined => {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
};

@Injectable()
export class HrmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollConfigService: PayrollConfigService,
  ) {}

  // ─── Organization & Structure ─────────────────────────────────────────────

  async getOrCreateOrganization(data?: {
    name?: string;
    domain?: string;
    id?: string;
  }) {
    if (data?.id) {
      const org = await this.prisma.organization.findUnique({
        where: { id: data.id },
        include: {
          settings: true,
          departments: true,
          designations: true,
          branches: true,
        },
      });
      if (org) return org;
    }

    const orgs = await this.prisma.organization.findMany({
      include: {
        settings: true,
        departments: true,
        designations: true,
        branches: true,
      },
      take: 1,
    });
    if (orgs.length > 0) return orgs[0];

    return this.prisma.organization.create({
      data: {
        name: data?.name || 'VoltNovate Solutions LLP',
        domain: data?.domain || 'voltnovate.com',
        settings: {
          create: {
            currency: 'INR',
            timezone: 'Asia/Kolkata',
            workingHours: 8.0,
          },
        },
        departments: {
          create: [
            { name: 'Technology', description: 'Software & Engineering' },
            { name: 'Operations', description: 'Business & HR Operations' },
            { name: 'Finance', description: 'Accounting & Payroll' },
          ],
        },
        designations: {
          create: [
            { name: 'Software Engineer', description: 'Core Engineering' },
            {
              name: 'Senior Developer',
              description: 'Lead Technical Architecture',
            },
            { name: 'HR Manager', description: 'Human Resource Operations' },
          ],
        },
        branches: {
          create: [{ name: 'Headquarters', location: 'Noida, UP, India' }],
        },
      },
      include: {
        settings: true,
        departments: true,
        designations: true,
        branches: true,
      },
    });
  }

  async listDepartments(organizationId?: string) {
    const org = await this.getOrCreateOrganization();
    const targetOrgId = organizationId || org.id;
    return this.prisma.department.findMany({
      where: { organizationId: targetOrgId, deletedAt: null },
      include: { _count: { select: { profiles: true, jobOpenings: true } } },
    });
  }

  async createDepartment(dto: {
    organizationId?: string;
    name: string;
    description?: string;
  }) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.department.create({
      data: {
        organizationId: dto.organizationId || org.id,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async listDesignations(organizationId?: string) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.designation.findMany({
      where: { organizationId: organizationId || org.id, deletedAt: null },
      include: { _count: { select: { profiles: true } } },
    });
  }

  async createDesignation(dto: {
    organizationId?: string;
    name: string;
    description?: string;
  }) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.designation.create({
      data: {
        organizationId: dto.organizationId || org.id,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async listBranches(organizationId?: string) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.branch.findMany({
      where: { organizationId: organizationId || org.id, deletedAt: null },
      include: { _count: { select: { profiles: true } } },
    });
  }

  async createBranch(
    dto: {
      organizationId?: string;
      name: string;
      location?: string;
    } & BranchGeofence,
  ) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.branch.create({
      data: {
        organizationId: dto.organizationId || org.id,
        name: dto.name,
        location: dto.location,
        ...cleanGeofence(dto),
      },
    });
  }

  /** Sets or clears a branch's office geofence (and its name/address). */
  async updateBranch(
    id: string,
    dto: { name?: string; location?: string } & BranchGeofence,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...cleanGeofence(dto),
      },
    });
  }

  // ─── Employee Extended Profile ─────────────────────────────────────────────

  async getEmployeeProfile(userId: string) {
    return this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
        department: true,
        designation: true,
        branch: true,
      },
    });
  }

  async upsertEmployeeProfile(userId: string, dto: any) {
    return this.prisma.employeeProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
      include: { department: true, designation: true, branch: true },
    });
  }

  async addEducation(userId: string, dto: any) {
    return this.prisma.employeeEducation.create({ data: { userId, ...dto } });
  }

  async addExperience(userId: string, dto: any) {
    const fromDate = parseCreateDate(dto.fromDate);
    const toDate = parseCreateDate(dto.toDate);
    if (!fromDate)
      throw new BadRequestException('Invalid experience start date format');
    if (!toDate)
      throw new BadRequestException('Invalid experience end date format');

    return this.prisma.employeeExperience.create({
      data: {
        userId,
        company: dto.company,
        designation: dto.designation,
        fromDate,
        toDate,
      },
    });
  }

  async addSkill(userId: string, dto: any) {
    return this.prisma.employeeSkill.create({ data: { userId, ...dto } });
  }

  // ─── IT Office Assets Registry ─────────────────────────────────────────────

  async listOfficeAssets(organizationId?: string) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.officeAsset.findMany({
      where: { organizationId: organizationId || org.id },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOfficeAsset(dto: any) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.officeAsset.create({
      data: {
        organizationId: dto.organizationId || org.id,
        name: dto.name,
        brand: dto.brand,
        model: dto.model,
        type: dto.type || 'LAPTOP',
        serialNumber: dto.serialNumber,
        cost: dto.cost ? Number(dto.cost) : undefined,
        purchaseDate: parseOptionalDate(dto.purchaseDate) || undefined,
        warrantyExpiry: parseOptionalDate(dto.warrantyExpiry) || undefined,
        condition: dto.condition || 'GOOD',
        status: 'AVAILABLE',
      },
    });
  }

  async assignOfficeAsset(assetId: string, employeeId: string, notes?: string) {
    const asset = await this.prisma.officeAsset.findUniqueOrThrow({
      where: { id: assetId },
    });
    if (asset.status === 'ISSUED')
      throw new BadRequestException('Asset is already assigned');

    await this.prisma.officeAsset.update({
      where: { id: assetId },
      data: { status: 'ISSUED' },
    });

    const assignment = await this.prisma.officeAssetAssignment.create({
      data: { assetId, employeeId, notes, status: 'ACTIVE' },
    });

    await this.prisma.officeAssetHistory.create({
      data: {
        assetId,
        action: 'ASSIGNED',
        notes: `Assigned to user ${employeeId}`,
      },
    });

    return assignment;
  }

  async returnOfficeAsset(assetId: string, notes?: string) {
    await this.prisma.officeAsset.update({
      where: { id: assetId },
      data: { status: 'AVAILABLE' },
    });

    await this.prisma.officeAssetAssignment.updateMany({
      where: { assetId, status: 'ACTIVE' },
      data: { status: 'RETURNED', returnDate: new Date() },
    });

    return this.prisma.officeAssetHistory.create({
      data: {
        assetId,
        action: 'RETURNED',
        notes: notes || 'Returned to inventory',
      },
    });
  }

  // ─── Recruitment ATS Module ────────────────────────────────────────────────

  async listJobOpenings(organizationId?: string) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.jobOpening.findMany({
      where: { organizationId: organizationId || org.id },
      include: {
        department: true,
        candidates: { include: { interviewRounds: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createJobOpening(dto: any) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.jobOpening.create({
      data: {
        organizationId: dto.organizationId || org.id,
        title: dto.title,
        departmentId: dto.departmentId,
        vacancies: Number(dto.vacancies || 1),
        status: dto.status || 'OPEN',
      },
      include: { department: true },
    });
  }

  async addCandidate(dto: any) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.candidate.create({
      data: {
        organizationId: dto.organizationId || org.id,
        jobOpeningId: dto.jobOpeningId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        stage: dto.stage || 'APPLIED',
      },
    });
  }

  async updateCandidateStage(candidateId: string, stage: any) {
    return this.prisma.candidate.update({
      where: { id: candidateId },
      data: { stage },
    });
  }

  async scheduleInterview(candidateId: string, dto: any) {
    return this.prisma.interviewRound.create({
      data: {
        candidateId,
        roundName: dto.roundName,
        scheduleTime: parseOptionalDate(dto.scheduleTime) || undefined,
        feedback: dto.feedback,
        status: 'SCHEDULED',
      },
    });
  }

  // ─── Expense Claims ────────────────────────────────────────────────────────

  async listExpenseClaims(employeeId?: string) {
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.expenseClaim.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createExpenseClaim(employeeId: string, dto: any) {
    return this.prisma.expenseClaim.create({
      data: {
        employeeId,
        title: dto.title,
        amount: Number(dto.amount),
        category: dto.category || 'General',
        remarks: dto.remarks,
        status: 'PENDING',
      },
    });
  }

  async updateExpenseStatus(
    claimId: string,
    status: any,
    approvedById: string,
    remarks?: string,
  ) {
    return this.prisma.expenseClaim.update({
      where: { id: claimId },
      data: { status, approvedById, remarks },
    });
  }

  // ─── HR Helpdesk Ticketing ────────────────────────────────────────────────

  async listHelpdeskTickets(employeeId?: string) {
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.hrHelpdeskTicket.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignedAgent: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createHelpdeskTicket(employeeId: string, dto: any) {
    return this.prisma.hrHelpdeskTicket.create({
      data: {
        employeeId,
        title: dto.title,
        description: dto.description,
        category: dto.category || 'HR Inquiry',
        priority: dto.priority || 'MEDIUM',
        status: 'OPEN',
      },
    });
  }

  async updateHelpdeskTicket(ticketId: string, dto: any) {
    return this.prisma.hrHelpdeskTicket.update({
      where: { id: ticketId },
      data: dto,
    });
  }

  // ─── Approval Workflows Engine ─────────────────────────────────────────────

  async listApprovalWorkflows(organizationId?: string) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.approvalWorkflow.findMany({
      where: { organizationId: organizationId || org.id },
      include: { steps: true },
    });
  }

  async createApprovalWorkflow(dto: any) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.approvalWorkflow.create({
      data: {
        organizationId: dto.organizationId || org.id,
        name: dto.name,
        type: dto.type || 'LEAVE',
        steps: {
          create: (dto.steps || []).map((s: any, idx: number) => ({
            stepNumber: idx + 1,
            approverId: s.approverId,
            required: s.required !== false,
          })),
        },
      },
      include: { steps: true },
    });
  }

  async logApprovalAction(actionByUserId: string, dto: any) {
    return this.prisma.approvalHistory.create({
      data: {
        actionByUserId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        stepNumber: Number(dto.stepNumber || 1),
        status: dto.status || 'APPROVED',
        comments: dto.comments,
      },
    });
  }

  // ─── Performance Management ────────────────────────────────────────────────

  async listPerformanceGoals(userId?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    return this.prisma.performanceGoal.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPerformanceGoal(dto: any) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.performanceGoal.create({
      data: {
        organizationId: dto.organizationId || org.id,
        userId: dto.userId,
        title: dto.title,
        progress: Number(dto.progress || 0),
        targetDate:
          parseCreateDate(dto.targetDate) ||
          new Date(Date.now() + 30 * 86400000),
      },
    });
  }

  async updatePerformanceGoal(goalId: string, progress: number) {
    return this.prisma.performanceGoal.update({
      where: { id: goalId },
      data: { progress: Number(progress) },
    });
  }

  async listPerformanceReviews(userId?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    return this.prisma.performanceReview.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPerformanceReview(dto: any) {
    return this.prisma.performanceReview.create({
      data: {
        userId: dto.userId,
        cycleName: dto.cycleName || 'Annual Review',
        selfRating: Number(dto.selfRating || 3),
        managerRating: Number(dto.managerRating || 3),
        comments: dto.comments,
      },
    });
  }

  // ─── Compensation & Payroll ────────────────────────────────────────────────

  async listPayrollRuns(organizationId?: string) {
    const org = await this.getOrCreateOrganization();
    return this.prisma.payrollRun.findMany({
      where: { organizationId: organizationId || org.id },
      include: {
        payslips: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async createPayrollRun(dto: any) {
    const org = await this.getOrCreateOrganization();
    // Prevent duplicate run for same month/year
    const existing = await this.prisma.payrollRun.findFirst({
      where: {
        organizationId: dto.organizationId || org.id,
        month: Number(dto.month),
        year: Number(dto.year),
      },
    });
    if (existing)
      throw new BadRequestException(
        `Payroll run for ${dto.month}/${dto.year} already exists (status: ${existing.status})`,
      );
    return this.prisma.payrollRun.create({
      data: {
        organizationId: dto.organizationId || org.id,
        month: Number(dto.month),
        year: Number(dto.year),
        status: 'DRAFT',
      },
    });
  }

  // ─── Dynamic Payroll Config Helpers ─────────────────────────────────────────

  // Fetch org-level payroll config. Backed by PayrollConfigVersion (versioned,
  // audited) as of the Enterprise Payroll Engine plan Slice 1 — previously this
  // read the flat, unversioned OrganizationSettings payroll block directly.
  private async getOrgPayrollConfig(organizationId?: string): Promise<any> {
    const org = await this.getOrCreateOrganization();
    const orgId = organizationId || org.id;
    return this.payrollConfigService.getCurrentConfig(orgId);
  }

  // Admin: Get org payroll config for settings UI
  async getPayrollConfig(organizationId?: string) {
    return this.getOrgPayrollConfig(organizationId);
  }

  // Admin: get the payroll config version that was/will be effective on a given date
  async getEffectivePayrollConfig(date: Date, organizationId?: string) {
    const org = await this.getOrCreateOrganization();
    const orgId = organizationId || org.id;
    return this.payrollConfigService.getEffectiveConfig(orgId, date);
  }

  // Admin: full version history for the audit/history UI
  async getPayrollConfigHistory(organizationId?: string) {
    const org = await this.getOrCreateOrganization();
    const orgId = organizationId || org.id;
    return this.payrollConfigService.getHistory(orgId);
  }

  // Admin: update org payroll config — creates a new PayrollConfigVersion plus a
  // PayrollConfigAuditLog entry per changed field; never overwrites in place.
  async updatePayrollConfig(
    dto: any,
    userId: string,
    reason: string,
    organizationId?: string,
  ) {
    const org = await this.getOrCreateOrganization();
    const orgId = organizationId || org.id;
    return this.payrollConfigService.createNewVersion(
      orgId,
      dto,
      userId,
      reason,
    );
  }

  // Compute salary defaults using org-level config (called before form render)
  computeSalaryDefaultsWithConfig(
    category: string,
    basicSalary: number,
    grossSalary: number,
    cfg: any,
  ): Record<string, any> {
    const typeDefaults = cfg.employmentTypeDefaults?.[category] || {};
    const skipPayroll = typeDefaults.skipPayroll === true;

    // Auto PF eligibility: mandatory if basic ≤ pfWageCeiling
    const autoPf =
      cfg.pfEnabled &&
      !skipPayroll &&
      (typeDefaults.pfApplicable ?? basicSalary <= cfg.pfWageCeiling);
    // High-package opt-out
    const pfOptional =
      cfg.highPackagePfOptional && basicSalary > cfg.highPackageBasicThreshold;

    const autoEsi =
      cfg.esiEnabled &&
      !skipPayroll &&
      (typeDefaults.esiApplicable ?? grossSalary <= cfg.esiGrossCeiling);

    // Conveyance by type
    const conveyance =
      category === 'EMPLOYEE'
        ? cfg.defaultConveyanceEmployee
        : category === 'CONTRACT'
          ? cfg.defaultConveyanceContract
          : cfg.defaultConveyanceIntern;

    // TDS for contract
    const tds =
      typeDefaults.tdsRate !== undefined
        ? Number(((grossSalary * typeDefaults.tdsRate) / 12).toFixed(0))
        : 0;

    return {
      pfApplicable: pfOptional ? false : autoPf,
      pfWageCeiling: cfg.pfWageCeiling,
      voluntaryPfPercent: 0,
      esiApplicable: autoEsi,
      esiGrossCeiling: cfg.esiGrossCeiling,
      professionalTaxOverride: typeDefaults.ptOverride ?? null, // null = auto slab
      conveyanceAllowance: conveyance,
      tds,
      gisDeduction: 0,
      npsEmployee: 0,
      otherDeductions: 0,
      taxRegime: cfg.defaultTaxRegime,
    };
  }

  // Legacy sync wrapper (used internally without org fetch)
  computeSalaryDefaults(
    category: string,
    basicSalary: number,
    grossSalary: number,
  ): Record<string, any> {
    // Fallback to hardcoded defaults when org config not available
    const fallbackCfg = {
      pfEnabled: true,
      pfWageCeiling: 15000,
      pfApplyWageCap: true,
      esiEnabled: true,
      esiGrossCeiling: 21000,
      defaultConveyanceEmployee: 1600,
      defaultConveyanceIntern: 0,
      defaultConveyanceContract: 0,
      defaultTaxRegime: 'NEW',
      highPackagePfOptional: false,
      highPackageBasicThreshold: 999999,
      employmentTypeDefaults: {
        EMPLOYEE: { pfApplicable: true, esiApplicable: true },
        PAID_INTERN: {
          pfApplicable: false,
          esiApplicable: false,
          ptOverride: 0,
        },
        CONTRACT: { pfApplicable: false, esiApplicable: false, tdsRate: 0.1 },
        UNPAID_INTERN: {
          pfApplicable: false,
          esiApplicable: false,
          ptOverride: 0,
          skipPayroll: true,
        },
      },
    };
    return this.computeSalaryDefaultsWithConfig(
      category,
      basicSalary,
      grossSalary,
      fallbackCfg,
    );
  }

  async getSalaryDefaults(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        employmentType: true,
        organizationId: true,
        employeeSalaries: { where: { status: 'ACTIVE' }, take: 1 },
      },
    });
    const category = user?.employmentType || 'EMPLOYEE';
    const existing = (user?.employeeSalaries as any)?.[0] ?? null;
    const basic = existing?.basicSalary ?? 0;
    const gross =
      basic + (existing?.hra ?? 0) + (existing?.conveyanceAllowance ?? 0);
    const cfg = await this.getOrgPayrollConfig(
      user?.organizationId || undefined,
    );
    return {
      employmentCategory: category,
      existing,
      orgConfig: cfg, // send full config to frontend so it can display rates
      suggestedDefaults: this.computeSalaryDefaultsWithConfig(
        category,
        basic,
        gross,
        cfg,
      ),
    };
  }

  async processPayrollRun(payrollRunId: string) {
    const run = await this.prisma.payrollRun.findUniqueOrThrow({
      where: { id: payrollRunId },
    });
    if (run.status !== 'DRAFT') {
      throw new BadRequestException(
        `Payroll run is already ${run.status} — cannot be re-processed.`,
      );
    }

    // ─ Load org dynamic config (PF/ESI/PT rates, LWP base, employment defaults) ─
    const cfg = await this.getOrgPayrollConfig(run.organizationId);

    const activeSalaries = await this.prisma.employeeSalary.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true },
    });

    const month = run.month;
    const year = run.year;
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // LWP salary divisor from org config
    const lwpDivisor =
      cfg.lwpCalculationBase === 'FIXED_26'
        ? 26
        : cfg.lwpCalculationBase === 'FIXED_30'
          ? 30
          : daysInMonth; // CALENDAR (default)

    for (const sal of activeSalaries) {
      const category =
        (sal as any).employmentCategory ||
        sal.user?.employmentType ||
        'EMPLOYEE';
      // Skip types configured with skipPayroll = true in org employment defaults
      const typeDefaults = cfg.employmentTypeDefaults?.[category] || {};
      if (typeDefaults.skipPayroll === true) continue;

      // —— Earnings ——
      const basic = sal.basicSalary;
      const hra = sal.hra ?? 0;
      const conveyance = (sal as any).conveyanceAllowance ?? 0;
      const special = (sal as any).specialAllowance ?? 0;
      const perf = (sal as any).performanceIncentive ?? 0;
      const da = (sal as any).daAllowance ?? 0;
      const otherEarn = (sal as any).otherAllowance ?? 0;
      const totalAllowances =
        hra + conveyance + special + perf + da + otherEarn;
      const grossPay = basic + totalAllowances;

      // —— Loss of Pay (LWP) ——
      let lwpDays = 0;
      let presentDays = 0;
      try {
        const lwpAgg = await this.prisma.leaveLedger.aggregate({
          where: {
            userId: sal.userId,
            leaveType: 'UNPAID',
            transactionType: 'LEAVE_DEBIT',
            createdAt: { gte: startDate, lte: endDate },
          },
          _sum: { quantity: true },
        });
        lwpDays = Math.abs(Number(lwpAgg._sum.quantity || 0));

        const attRecords = await this.prisma.attendance.findMany({
          where: {
            employeeId: sal.userId,
            date: { gte: startDate, lte: endDate },
          },
          select: { status: true },
        });
        presentDays = attRecords.reduce((acc, r) => {
          if (r.status === 'PRESENT' || r.status === 'LATE') return acc + 1;
          if (r.status === 'HALF_DAY') return acc + 0.5;
          return acc;
        }, 0);
        const absentCount = attRecords.filter(
          (r) => r.status === 'ABSENT',
        ).length;
        if (absentCount > lwpDays) lwpDays = absentCount; // absent without leave = LWP
      } catch (_) {}

      const lwpDeduction =
        lwpDays > 0
          ? Number(((grossPay / lwpDivisor) * lwpDays).toFixed(2))
          : 0;

      const grossEarned = grossPay - lwpDeduction;

      // —— PF / ESI / PT ——
      // Enterprise Payroll Engine gap-closure: this legacy path and the new
      // component-driven /calculate workflow now both call the exact same
      // statutory-calculator.ts functions, so the two paths cannot silently
      // drift into different PF/ESI/PT arithmetic. The inputs each path
      // gathers them from still differ (fixed EmployeeSalary fields here vs.
      // dynamic SalaryComponent sums there) — only the formulas are shared.
      const pfResult = calculatePf(
        basic,
        Boolean(cfg.pfEnabled && sal.pfApplicable),
        {
          enabled: cfg.pfEnabled,
          employeeRate: cfg.pfEmployeeRate,
          employerRate: cfg.pfEmployerRate,
          wageCeiling: cfg.pfWageCeiling,
          applyWageCap: cfg.pfApplyWageCap,
        },
        (sal as any).voluntaryPfPercent ?? 0,
        (sal as any).pfWageCeiling,
      );
      const pfEmployee = pfResult.pfEmployee;
      const pfEmployer = pfResult.pfEmployer;

      const esiResult = calculateEsi(
        grossEarned,
        Boolean(cfg.esiEnabled && sal.esiApplicable),
        {
          enabled: cfg.esiEnabled,
          employeeRate: cfg.esiEmployeeRate,
          employerRate: cfg.esiEmployerRate,
          grossCeiling: cfg.esiGrossCeiling,
        },
        (sal as any).esiGrossCeiling,
      );
      const esiEmployee = esiResult.esiEmployee;
      const esiEmployer = esiResult.esiEmployer;

      const professionalTax = calculatePt(
        grossEarned,
        cfg.ptEnabled,
        cfg.ptSlabs || [],
        (sal as any).professionalTaxOverride,
      );

      // —— TDS + other deductions ——
      const tds = Number((sal as any).tds ?? 0);
      const gisDeduction = Number((sal as any).gisDeduction ?? 0);
      const npsEmployee = Number((sal as any).npsEmployee ?? 0);
      const otherDed = Number((sal as any).otherDeductions ?? 0);

      const totalDeductions =
        pfEmployee +
        esiEmployee +
        professionalTax +
        tds +
        gisDeduction +
        npsEmployee +
        lwpDeduction +
        otherDed;
      const netPay = Math.max(
        0,
        Number(
          (
            grossEarned -
            pfEmployee -
            esiEmployee -
            professionalTax -
            tds -
            gisDeduction -
            npsEmployee -
            otherDed
          ).toFixed(2),
        ),
      );

      const payslipData: any = {
        payrollRunId: run.id,
        userId: sal.userId,
        // Earnings
        basic,
        hra,
        conveyanceAllowance: conveyance,
        specialAllowance: special,
        performanceIncentive: perf,
        daAllowance: da,
        otherAllowance: otherEarn,
        allowances: totalAllowances,
        grossPay,
        // Deductions
        pfEmployee,
        pfEmployer,
        esiEmployee,
        esiEmployer,
        professionalTax,
        tds,
        gisDeduction,
        npsEmployee,
        lwpDays,
        lwpDeduction,
        otherDeductions: otherDed,
        deductions: Number(totalDeductions.toFixed(2)),
        // Attendance
        workingDays: daysInMonth,
        presentDays,
        // Net
        netPay,
      };

      await this.prisma.payslip.upsert({
        where: {
          payrollRunId_userId: { payrollRunId: run.id, userId: sal.userId },
        },
        create: payslipData,
        update: payslipData,
      });
    }

    return this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'APPROVED', processedAt: new Date() },
      include: {
        payslips: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async upsertEmployeeSalary(userId: string, dto: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { employmentType: true },
    });
    const category: string =
      dto.employmentCategory || user?.employmentType || 'EMPLOYEE';

    await this.prisma.employeeSalary.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'HISTORIC' },
    });

    const basicSalary = Number(dto.basicSalary || 0);
    const hra = Number(dto.hra || 0);
    const conveyance = Number(
      dto.conveyanceAllowance ?? (category === 'EMPLOYEE' ? 1600 : 0),
    );
    const special = Number(dto.specialAllowance ?? 0);
    const gross = basicSalary + hra + conveyance + special;
    const smartDefaults = this.computeSalaryDefaults(
      category,
      basicSalary,
      gross,
    );

    // Admin overrides smart defaults; fall back to smart default if field not sent
    const pfApplicable =
      dto.pfApplicable !== undefined
        ? Boolean(dto.pfApplicable)
        : smartDefaults.pfApplicable;
    const esiApplicable =
      dto.esiApplicable !== undefined
        ? Boolean(dto.esiApplicable)
        : smartDefaults.esiApplicable;

    return this.prisma.employeeSalary.create({
      data: {
        userId,
        effectiveFrom: parseCreateDate(dto.effectiveFrom) || new Date(),
        ctc: Number(dto.ctc || 0),
        basicSalary,
        hra,
        conveyanceAllowance: conveyance,
        specialAllowance: special,
        performanceIncentive: Number(dto.performanceIncentive ?? 0),
        daAllowance: Number(dto.daAllowance ?? 0),
        otherAllowance: Number(dto.otherAllowance ?? 0),
        // PF
        pfApplicable,
        pfWageCeiling: Number(dto.pfWageCeiling ?? 15000),
        voluntaryPfPercent: Number(dto.voluntaryPfPercent ?? 0),
        employerPfApplicable: dto.employerPfApplicable !== false,
        pfNumber: dto.pfNumber || null,
        // ESI
        esiApplicable,
        esiGrossCeiling: Number(dto.esiGrossCeiling ?? 21000),
        esiNumber: dto.esiNumber || null,
        // PT — null means auto Karnataka slab
        professionalTaxOverride:
          dto.professionalTaxOverride !== undefined &&
          dto.professionalTaxOverride !== null &&
          dto.professionalTaxOverride !== ''
            ? Number(dto.professionalTaxOverride)
            : (smartDefaults.professionalTaxOverride ?? null),
        // Other deductions
        tds: Number(dto.tds ?? smartDefaults.tds ?? 0),
        gisDeduction: Number(dto.gisDeduction ?? 0),
        npsEmployee: Number(dto.npsEmployee ?? 0),
        otherDeductions: Number(dto.otherDeductions ?? 0),
        // Classification
        employmentCategory: category,
        taxRegime: dto.taxRegime || 'NEW',
        salaryCycle: dto.salaryCycle || 'Monthly',
        paymentMode: dto.paymentMode || 'Bank Transfer',
        status: 'ACTIVE',
      },
    });
  }

  async getPayrollRunPayslips(payrollRunId: string) {
    return this.prisma.payslip.findMany({
      where: { payrollRunId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employmentType: true,
          },
        },
      },
      orderBy: { netPay: 'desc' },
    });
  }

  async getEmployeeSalary(userId: string) {
    return this.prisma.employeeSalary.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
  }
}

export interface BranchGeofence {
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
}

/** Valid coordinates and a sane radius (25 m to 5 km), or null to switch the geofence off. */
export function cleanGeofence(dto: BranchGeofence): BranchGeofence {
  const out: BranchGeofence = {};
  if (dto.latitude === null || dto.longitude === null)
    return { latitude: null, longitude: null, radiusMeters: null };
  if (dto.latitude !== undefined || dto.longitude !== undefined) {
    const lat = Number(dto.latitude),
      lon = Number(dto.longitude);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      throw new BadRequestException('Office latitude/longitude are not valid');
    out.latitude = lat;
    out.longitude = lon;
  }
  if (dto.radiusMeters !== undefined && dto.radiusMeters !== null) {
    const r = Math.round(Number(dto.radiusMeters));
    if (!Number.isFinite(r) || r < 25 || r > 5000)
      throw new BadRequestException(
        'Office radius must be between 25 m and 5 km',
      );
    out.radiusMeters = r;
  }
  return out;
}
