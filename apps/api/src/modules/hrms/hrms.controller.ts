import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { HrmsService } from './hrms.service';
import { StatutoryExportsService } from './payroll/statutory-exports.service';
import type { ExportKind } from './payroll/statutory-exports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';

const HR_ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER'];

@Controller('hrms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HrmsController {
  constructor(
    private readonly hrmsService: HrmsService,
    private readonly exports: StatutoryExportsService,
  ) {}

  private resolveOrgId(req: any, queryOrgId?: string): string | undefined {
    const user = req?.user;
    if (user?.userType === 'CUSTOMER') {
      return user.activeOrganizationId || undefined;
    }
    return queryOrgId;
  }

  // ─── Organization & Structure ─────────────────────────────────────────────

  @Get('organization')
  @Roles(HR_ADMIN_ROLES)
  getOrganization(@Req() req: any) {
    const orgId = this.resolveOrgId(req);
    return this.hrmsService.getOrCreateOrganization(orgId ? { id: orgId } : undefined);
  }

  @Get('departments')
  @Roles(HR_ADMIN_ROLES)
  listDepartments(
    @Req() req: any,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.hrmsService.listDepartments(this.resolveOrgId(req, organizationId));
  }

  @Post('departments')
  @HttpCode(201)
  @Roles(HR_ADMIN_ROLES)
  createDepartment(
    @Req() req: any,
    @Body()
    dto: {
      organizationId?: string;
      name: string;
      description?: string;
    },
  ) {
    return this.hrmsService.createDepartment({
      ...dto,
      organizationId: this.resolveOrgId(req, dto.organizationId),
    });
  }

  @Get('designations')
  @Roles(HR_ADMIN_ROLES)
  listDesignations(
    @Req() req: any,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.hrmsService.listDesignations(this.resolveOrgId(req, organizationId));
  }

  @Post('designations')
  @HttpCode(201)
  @Roles(HR_ADMIN_ROLES)
  createDesignation(
    @Req() req: any,
    @Body()
    dto: {
      organizationId?: string;
      name: string;
      description?: string;
    },
  ) {
    return this.hrmsService.createDesignation({
      ...dto,
      organizationId: this.resolveOrgId(req, dto.organizationId),
    });
  }

  @Get('branches')
  @Roles(HR_ADMIN_ROLES)
  listBranches(
    @Req() req: any,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.hrmsService.listBranches(this.resolveOrgId(req, organizationId));
  }

  @Post('branches')
  @HttpCode(201)
  @Roles(HR_ADMIN_ROLES)
  createBranch(
    @Req() req: any,
    @Body()
    dto: {
      organizationId?: string;
      name: string;
      location?: string;
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
    },
  ) {
    return this.hrmsService.createBranch({
      ...dto,
      organizationId: this.resolveOrgId(req, dto.organizationId),
    });
  }

  @Patch('branches/:id')
  @Roles(HR_ADMIN_ROLES)
  updateBranch(
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      location?: string;
      latitude?: number | null;
      longitude?: number | null;
      radiusMeters?: number | null;
    },
  ) {
    return this.hrmsService.updateBranch(id, dto);
  }

  // ─── Employee Profile & Vault ──────────────────────────────────────────────

  @Get('profiles/:userId')
  getProfile(@Param('userId') userId: string) {
    return this.hrmsService.getEmployeeProfile(userId);
  }

  @Post('profiles/:userId')
  @HttpCode(200)
  @Roles(HR_ADMIN_ROLES)
  upsertProfile(@Param('userId') userId: string, @Body() dto: any) {
    return this.hrmsService.upsertEmployeeProfile(userId, dto);
  }

  @Post('profiles/:userId/education')
  @HttpCode(201)
  addEducation(@Param('userId') userId: string, @Body() dto: any) {
    return this.hrmsService.addEducation(userId, dto);
  }

  @Post('profiles/:userId/experience')
  @HttpCode(201)
  addExperience(@Param('userId') userId: string, @Body() dto: any) {
    return this.hrmsService.addExperience(userId, dto);
  }

  @Post('profiles/:userId/skills')
  @HttpCode(201)
  addSkill(@Param('userId') userId: string, @Body() dto: any) {
    return this.hrmsService.addSkill(userId, dto);
  }

  // ─── IT Office Assets Registry ─────────────────────────────────────────────

  @Get('office-assets')
  @Roles(HR_ADMIN_ROLES)
  listOfficeAssets(@Query('organizationId') organizationId?: string) {
    return this.hrmsService.listOfficeAssets(organizationId);
  }

  @Post('office-assets')
  @HttpCode(201)
  @Roles(HR_ADMIN_ROLES)
  createOfficeAsset(@Body() dto: any) {
    return this.hrmsService.createOfficeAsset(dto);
  }

  @Post('office-assets/:id/assign')
  @HttpCode(200)
  @Roles(HR_ADMIN_ROLES)
  assignOfficeAsset(
    @Param('id') id: string,
    @Body() dto: { employeeId: string; notes?: string },
  ) {
    return this.hrmsService.assignOfficeAsset(id, dto.employeeId, dto.notes);
  }

  @Post('office-assets/:id/return')
  @HttpCode(200)
  @Roles(HR_ADMIN_ROLES)
  returnOfficeAsset(@Param('id') id: string, @Body() dto: { notes?: string }) {
    return this.hrmsService.returnOfficeAsset(id, dto.notes);
  }

  // ─── Recruitment ATS Module ────────────────────────────────────────────────

  @Get('ats/jobs')
  @Roles(HR_ADMIN_ROLES)
  listJobOpenings(@Query('organizationId') organizationId?: string) {
    return this.hrmsService.listJobOpenings(organizationId);
  }

  @Post('ats/jobs')
  @HttpCode(201)
  @Roles(HR_ADMIN_ROLES)
  createJobOpening(@Body() dto: any) {
    return this.hrmsService.createJobOpening(dto);
  }

  @Post('ats/candidates')
  @HttpCode(201)
  addCandidate(@Body() dto: any) {
    return this.hrmsService.addCandidate(dto);
  }

  @Patch('ats/candidates/:id/stage')
  @Roles(HR_ADMIN_ROLES)
  updateCandidateStage(@Param('id') id: string, @Body('stage') stage: string) {
    return this.hrmsService.updateCandidateStage(id, stage);
  }

  @Post('ats/candidates/:id/interviews')
  @HttpCode(201)
  @Roles(HR_ADMIN_ROLES)
  scheduleInterview(@Param('id') id: string, @Body() dto: any) {
    return this.hrmsService.scheduleInterview(id, dto);
  }

  // ─── Expense Claims ────────────────────────────────────────────────────────

  @Get('expenses')
  listExpenseClaims(@Req() req: any, @Query('employeeId') employeeId?: string) {
    const isHrAdmin = HR_ADMIN_ROLES.includes(req.user.role);
    const targetEmpId = isHrAdmin ? employeeId : req.user.id;
    return this.hrmsService.listExpenseClaims(targetEmpId);
  }

  @Post('expenses')
  @HttpCode(201)
  createExpenseClaim(@Req() req: any, @Body() dto: any) {
    return this.hrmsService.createExpenseClaim(req.user.id, dto);
  }

  @Patch('expenses/:id/status')
  @Roles(HR_ADMIN_ROLES)
  updateExpenseStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: { status: string; remarks?: string },
  ) {
    return this.hrmsService.updateExpenseStatus(
      id,
      dto.status,
      req.user.id,
      dto.remarks,
    );
  }

  // ─── HR Helpdesk Ticketing ────────────────────────────────────────────────

  @Get('helpdesk')
  listHelpdeskTickets(
    @Req() req: any,
    @Query('employeeId') employeeId?: string,
  ) {
    const isHrAdmin = HR_ADMIN_ROLES.includes(req.user.role);
    const targetEmpId = isHrAdmin ? employeeId : req.user.id;
    return this.hrmsService.listHelpdeskTickets(targetEmpId);
  }

  @Post('helpdesk')
  @HttpCode(201)
  createHelpdeskTicket(@Req() req: any, @Body() dto: any) {
    return this.hrmsService.createHelpdeskTicket(req.user.id, dto);
  }

  @Patch('helpdesk/:id')
  @Roles(HR_ADMIN_ROLES)
  updateHelpdeskTicket(@Param('id') id: string, @Body() dto: any) {
    return this.hrmsService.updateHelpdeskTicket(id, dto);
  }

  // ─── Approval Workflows Engine ─────────────────────────────────────────────

  @Get('approvals/workflows')
  @Roles(HR_ADMIN_ROLES)
  listApprovalWorkflows(@Query('organizationId') organizationId?: string) {
    return this.hrmsService.listApprovalWorkflows(organizationId);
  }

  @Post('approvals/workflows')
  @HttpCode(201)
  @Roles(HR_ADMIN_ROLES)
  createApprovalWorkflow(@Body() dto: any) {
    return this.hrmsService.createApprovalWorkflow(dto);
  }

  @Post('approvals/action')
  @HttpCode(200)
  logApprovalAction(@Req() req: any, @Body() dto: any) {
    return this.hrmsService.logApprovalAction(req.user.id, dto);
  }

  // ─── Performance Management ────────────────────────────────────────────────

  @Get('performance/goals')
  listPerformanceGoals(@Req() req: any, @Query('userId') userId?: string) {
    const isHrAdmin = HR_ADMIN_ROLES.includes(req.user.role);
    const targetUserId = isHrAdmin ? userId : req.user.id;
    return this.hrmsService.listPerformanceGoals(targetUserId);
  }

  @Post('performance/goals')
  @HttpCode(201)
  createPerformanceGoal(@Body() dto: any) {
    return this.hrmsService.createPerformanceGoal(dto);
  }

  @Patch('performance/goals/:id')
  updatePerformanceGoal(
    @Param('id') id: string,
    @Body('progress') progress: number,
  ) {
    return this.hrmsService.updatePerformanceGoal(id, progress);
  }

  @Get('performance/reviews')
  listPerformanceReviews(@Req() req: any, @Query('userId') userId?: string) {
    const isHrAdmin = HR_ADMIN_ROLES.includes(req.user.role);
    const targetUserId = isHrAdmin ? userId : req.user.id;
    return this.hrmsService.listPerformanceReviews(targetUserId);
  }

  @Post('performance/reviews')
  @HttpCode(201)
  @Roles(HR_ADMIN_ROLES)
  createPerformanceReview(@Body() dto: any) {
    return this.hrmsService.createPerformanceReview(dto);
  }

  // ─── Compensation & Payroll Engine ───────────────────────────────────────

  @Get('payroll/runs')
  @Roles(HR_ADMIN_ROLES)
  listPayrollRuns(@Query('organizationId') organizationId?: string) {
    return this.hrmsService.listPayrollRuns(organizationId);
  }

  @Post('payroll/runs')
  @HttpCode(201)
  @Roles(HR_ADMIN_ROLES)
  createPayrollRun(@Body() dto: any) {
    return this.hrmsService.createPayrollRun(dto);
  }

  @Post('payroll/runs/:id/process')
  @HttpCode(200)
  @Roles(HR_ADMIN_ROLES)
  processPayrollRun(@Param('id') id: string) {
    return this.hrmsService.processPayrollRun(id);
  }

  @Post('payroll/salaries/:userId')
  @HttpCode(200)
  @Roles(HR_ADMIN_ROLES)
  upsertEmployeeSalary(@Param('userId') userId: string, @Body() dto: any) {
    return this.hrmsService.upsertEmployeeSalary(userId, dto);
  }

  // GET /hrms/payroll/salaries/:userId/defaults
  // Returns: employment type + existing salary + smart-computed statutory defaults
  // Used by frontend to auto-fill the salary form when admin selects an employee
  @Get('payroll/salaries/:userId/defaults')
  @Roles(HR_ADMIN_ROLES)
  getSalaryDefaults(@Param('userId') userId: string) {
    return this.hrmsService.getSalaryDefaults(userId);
  }

  // GET /hrms/payroll/salaries/:userId
  // Returns: current active EmployeeSalary for an employee
  @Get('payroll/salaries/:userId')
  @Roles(HR_ADMIN_ROLES)
  getEmployeeSalary(@Param('userId') userId: string) {
    return this.hrmsService.getEmployeeSalary(userId);
  }

  // GET /hrms/payroll/runs/:id/payslips
  // Returns: all payslips for a specific payroll run (itemized breakdown)
  @Get('payroll/runs/:id/payslips')
  @Roles(HR_ADMIN_ROLES)
  getPayrollRunPayslips(@Param('id') id: string) {
    return this.hrmsService.getPayrollRunPayslips(id);
  }

  // Bank transfer sheet, PF ECR and ESI contribution files of an approved run.
  @Get('payroll/runs/:id/exports/:kind')
  @Roles(HR_ADMIN_ROLES)
  exportPayrollRun(@Param('id') id: string, @Param('kind') kind: ExportKind) {
    return this.exports.runExport(id, kind);
  }

  // Form 16 Part B style yearly salary statement (fy = start year, e.g. 2026 for FY 2026-27).
  @Get('payroll/statement/:userId')
  @Roles(HR_ADMIN_ROLES)
  annualSalaryStatement(
    @Param('userId') userId: string,
    @Query('fy') fy: string,
  ) {
    return this.exports.annualStatement(userId, Number(fy));
  }

  // An employee's own yearly statement.
  @Get('payroll/my-statement')
  myAnnualSalaryStatement(@Req() req: any, @Query('fy') fy: string) {
    return this.exports.annualStatement(req.user.id, Number(fy));
  }

  // Full & final settlement preview; markSettled=true records it on the profile.
  @Post('payroll/fnf/:userId')
  @HttpCode(200)
  @Roles(HR_ADMIN_ROLES)
  fullAndFinal(@Param('userId') userId: string, @Body() dto: any) {
    return this.exports.fullAndFinal(userId, dto || {});
  }

  // ─── Org Payroll Config (Admin-editable statutory rates, versioned) ───────
  // GET   /hrms/payroll/config           → current active version
  // GET   /hrms/payroll/config/effective → version effective on a given date
  // GET   /hrms/payroll/config/history   → every version, newest first
  // PATCH /hrms/payroll/config           → creates a new version (changeReason required)
  //
  // Fields admin can update:
  //   pfEmployeeRate, pfEmployerRate, pfWageCeiling, pfApplyWageCap, pfEnabled
  //   esiEmployeeRate, esiEmployerRate, esiGrossCeiling, esiEnabled
  //   ptState, ptSlabs (array), ptEnabled
  //   lwpCalculationBase (CALENDAR | FIXED_26 | FIXED_30)
  //   defaultConveyanceEmployee, defaultConveyanceIntern, defaultConveyanceContract
  //   defaultTaxRegime (NEW | OLD)
  //   employmentTypeDefaults (JSON object with per-type rules)
  //   highPackageBasicThreshold, highPackagePfOptional
  //   changeReason (String, required on every PATCH)

  @Get('payroll/config')
  @Roles(['SUPER_ADMIN'])
  getPayrollConfig(@Query('organizationId') organizationId?: string) {
    return this.hrmsService.getPayrollConfig(organizationId);
  }

  @Get('payroll/config/effective')
  @Roles(['SUPER_ADMIN'])
  getEffectivePayrollConfig(
    @Query('date') date: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const parsed = date ? new Date(date) : new Date();
    return this.hrmsService.getEffectivePayrollConfig(parsed, organizationId);
  }

  @Get('payroll/config/history')
  @Roles(['SUPER_ADMIN'])
  getPayrollConfigHistory(@Query('organizationId') organizationId?: string) {
    return this.hrmsService.getPayrollConfigHistory(organizationId);
  }

  @Patch('payroll/config')
  @Roles(['SUPER_ADMIN'])
  updatePayrollConfig(
    @Req() req: any,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { changeReason, ...configDto } = dto ?? {};
    return this.hrmsService.updatePayrollConfig(
      configDto,
      req.user.id,
      changeReason,
      organizationId,
    );
  }
}
