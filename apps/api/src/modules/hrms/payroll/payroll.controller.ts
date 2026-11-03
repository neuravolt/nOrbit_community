import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../users/guards/roles.guard';
import { SalaryComponentService } from './salary-component.service';
import { HolidayCalendarService } from './holiday-calendar.service';
import { WorkingWeekService } from './working-week.service';
import { TaxConfigService } from './tax-config.service';
import { PayrollAdjustmentService } from './payroll-adjustment.service';
import { PayrollWorkflowService } from './payroll-workflow.service';
import { PayrollAuditService } from './payroll-audit.service';
import { EmployeeOverrideService } from './employee-override.service';
import { PayrollMigrationService } from './payroll-migration.service';
import { PayrollFormulaEngine } from './formula-engine';
import { HrmsService } from '../hrms.service';

// Section 22/23 — this repo's RBAC is role-name based (JwtAuthGuard +
// RolesGuard + @Roles([...])), with no fine-grained permission system
// (VIEW_PAYROLL, RUN_PAYROLL, etc. as named permissions) wired to guards
// anywhere else in the codebase — a Permission/RolePermission model exists in
// the schema but nothing reads it at the guard layer. Building a parallel
// permission system used only by this one controller would be more
// disruptive than useful, so the requested permissions are mapped onto the
// existing role-based pattern instead, documented here:
//   VIEW_PAYROLL           -> HR_ADMIN_ROLES (read endpoints)
//   RUN_PAYROLL/APPROVE/... -> HR_ADMIN_ROLES (day-to-day workflow actions)
//   EDIT_STATUTORY_CONFIG   -> SUPER_ADMIN only (PF/ESI/PT/tax rates)
//   LOCK_PAYROLL            -> SUPER_ADMIN only (irreversible terminal action)
const HR_ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER'];
const STATUTORY_ADMIN_ROLES = ['SUPER_ADMIN'];

@Controller('hrms/payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(
    private readonly salaryComponents: SalaryComponentService,
    private readonly holidays: HolidayCalendarService,
    private readonly workingWeek: WorkingWeekService,
    private readonly taxConfig: TaxConfigService,
    private readonly adjustments: PayrollAdjustmentService,
    private readonly workflow: PayrollWorkflowService,
    private readonly audit: PayrollAuditService,
    private readonly overrides: EmployeeOverrideService,
    private readonly migration: PayrollMigrationService,
    private readonly hrmsService: HrmsService,
  ) {}

  private async orgId(organizationId?: string): Promise<string> {
    if (organizationId) return organizationId;
    const org = await this.hrmsService.getOrCreateOrganization();
    return org.id;
  }

  // ─── Salary Components ─────────────────────────────────────────────────
  @Get('components')
  @Roles(HR_ADMIN_ROLES)
  async listComponents(
    @Query('organizationId') organizationId?: string,
    @Query('type') type?: string,
  ) {
    return this.salaryComponents.list(await this.orgId(organizationId), {
      type,
    });
  }

  @Post('components')
  @Roles(STATUTORY_ADMIN_ROLES)
  async createComponent(
    @Req() req: any,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { reason, ...rest } = dto ?? {};
    return this.salaryComponents.create(
      await this.orgId(organizationId),
      rest,
      req.user.id,
      reason,
    );
  }

  @Patch('components/:id')
  @Roles(STATUTORY_ADMIN_ROLES)
  async updateComponent(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { reason, ...rest } = dto ?? {};
    return this.salaryComponents.update(
      id,
      rest,
      await this.orgId(organizationId),
      req.user.id,
      reason,
    );
  }

  @Post('components/:id/deactivate')
  @Roles(STATUTORY_ADMIN_ROLES)
  async deactivateComponent(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.salaryComponents.deactivate(
      id,
      await this.orgId(organizationId),
      req.user.id,
      dto?.reason,
    );
  }

  @Post('components/:id/assign')
  @Roles(HR_ADMIN_ROLES)
  async assignComponent(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.salaryComponents.assignToEmployee(
      id,
      dto.userId,
      dto,
      req.user.id,
      await this.orgId(organizationId),
      dto.reason,
    );
  }

  @Get('components/:id/audit')
  @Roles(HR_ADMIN_ROLES)
  async componentAuditHistory(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.audit.history(
      await this.orgId(organizationId),
      'SALARY_COMPONENT',
      id,
    );
  }

  @Post('formula/validate')
  @Roles(HR_ADMIN_ROLES)
  validateFormula(@Body() dto: { formula: string }) {
    return PayrollFormulaEngine.validate(dto.formula);
  }

  // ─── Holiday Calendar ───────────────────────────────────────────────────
  @Get('holidays/calendars')
  @Roles(HR_ADMIN_ROLES)
  async listCalendars(
    @Query('organizationId') organizationId?: string,
    @Query('year') year?: string,
  ) {
    return this.holidays.listCalendars(
      await this.orgId(organizationId),
      year ? Number(year) : undefined,
    );
  }

  @Post('holidays/calendars')
  @Roles(HR_ADMIN_ROLES)
  async createCalendar(
    @Req() req: any,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { reason, ...rest } = dto ?? {};
    return this.holidays.createCalendar(
      await this.orgId(organizationId),
      rest,
      req.user.id,
      reason,
    );
  }

  @Patch('holidays/calendars/:id')
  @Roles(HR_ADMIN_ROLES)
  async updateCalendar(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { reason, ...rest } = dto ?? {};
    return this.holidays.updateCalendar(
      id,
      rest,
      await this.orgId(organizationId),
      req.user.id,
      reason,
    );
  }

  @Post('holidays/calendars/:id/deactivate')
  @Roles(HR_ADMIN_ROLES)
  async deactivateCalendar(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.holidays.deactivateCalendar(
      id,
      await this.orgId(organizationId),
      req.user.id,
      dto?.reason,
    );
  }

  @Post('holidays/calendars/:id/holidays')
  @Roles(HR_ADMIN_ROLES)
  async addHoliday(
    @Req() req: any,
    @Param('id') calendarId: string,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { reason, ...rest } = dto ?? {};
    return this.holidays.addHoliday(
      calendarId,
      rest,
      await this.orgId(organizationId),
      req.user.id,
      reason,
    );
  }

  @Patch('holidays/:id')
  @Roles(HR_ADMIN_ROLES)
  async updateHoliday(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { reason, ...rest } = dto ?? {};
    return this.holidays.updateHoliday(
      id,
      rest,
      await this.orgId(organizationId),
      req.user.id,
      reason,
    );
  }

  @Post('holidays/:id/remove')
  @Roles(HR_ADMIN_ROLES)
  async removeHoliday(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.holidays.removeHoliday(
      id,
      await this.orgId(organizationId),
      req.user.id,
      dto?.reason,
    );
  }

  @Post('holidays/assign')
  @Roles(HR_ADMIN_ROLES)
  async assignHolidayCalendar(
    @Req() req: any,
    @Body() dto: { calendarId: string; userId: string; reason?: string },
    @Query('organizationId') organizationId?: string,
  ) {
    return this.holidays.assignEmployee(
      dto.calendarId,
      dto.userId,
      await this.orgId(organizationId),
      req.user.id,
      dto.reason,
    );
  }

  @Get('holidays/calendars/:id/audit')
  @Roles(HR_ADMIN_ROLES)
  async calendarAuditHistory(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.audit.history(
      await this.orgId(organizationId),
      'HOLIDAY_CALENDAR',
      id,
    );
  }

  // ─── Working Week ───────────────────────────────────────────────────────
  @Get('working-week')
  @Roles(HR_ADMIN_ROLES)
  async getWorkingWeek(@Query('organizationId') organizationId?: string) {
    return this.workingWeek.getCurrent(await this.orgId(organizationId));
  }

  @Patch('working-week')
  @Roles(HR_ADMIN_ROLES)
  async updateWorkingWeek(
    @Req() req: any,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { reason, ...rest } = dto ?? {};
    return this.workingWeek.update(
      await this.orgId(organizationId),
      rest,
      req.user.id,
      reason,
    );
  }

  @Get('working-week/audit')
  @Roles(HR_ADMIN_ROLES)
  async workingWeekAuditHistory(
    @Query('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.audit.history(
      await this.orgId(organizationId),
      'WORKING_WEEK',
      id,
    );
  }

  // ─── Tax Configuration ──────────────────────────────────────────────────
  @Get('tax/config')
  @Roles(HR_ADMIN_ROLES)
  async getTaxConfig(
    @Query('fy') fy: string,
    @Query('regime') regime: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.taxConfig.getEffective(
      await this.orgId(organizationId),
      fy,
      regime,
    );
  }

  @Post('tax/config')
  @Roles(STATUTORY_ADMIN_ROLES)
  async createTaxConfig(
    @Req() req: any,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { reason, ...rest } = dto ?? {};
    return this.taxConfig.create(
      await this.orgId(organizationId),
      rest,
      req.user.id,
      reason,
    );
  }

  @Patch('tax/config')
  @Roles(STATUTORY_ADMIN_ROLES)
  async updateTaxConfig(
    @Req() req: any,
    @Query('fy') fy: string,
    @Query('regime') regime: string,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { reason, ...rest } = dto ?? {};
    return this.taxConfig.update(
      await this.orgId(organizationId),
      fy,
      regime,
      rest,
      req.user.id,
      reason,
    );
  }

  @Get('tax/config/history')
  @Roles(HR_ADMIN_ROLES)
  async getTaxConfigHistory(
    @Query('fy') fy: string,
    @Query('regime') regime: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.taxConfig.getHistory(
      await this.orgId(organizationId),
      fy,
      regime,
    );
  }

  @Get('tax/config/audit')
  @Roles(HR_ADMIN_ROLES)
  async taxConfigAuditHistory(
    @Query('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.audit.history(
      await this.orgId(organizationId),
      'TAX_REGIME_CONFIG',
      id,
    );
  }

  // ─── Adjustments / Arrears ──────────────────────────────────────────────
  @Post('adjustments')
  @Roles(HR_ADMIN_ROLES)
  async createAdjustment(@Req() req: any, @Body() dto: any) {
    return this.adjustments.create(
      await this.orgId(dto.organizationId),
      dto.userId,
      dto,
      req.user.id,
    );
  }

  // Only PENDING is currently supported — listPending() is the one query the
  // service exposes; a full status-filterable list is a straightforward
  // future addition if/when the admin UI needs to browse approved/applied
  // adjustments too.
  @Get('adjustments')
  @Roles(HR_ADMIN_ROLES)
  async listAdjustments(@Query('organizationId') organizationId?: string) {
    return this.adjustments.listPending(await this.orgId(organizationId));
  }

  @Patch('adjustments/:id/approve')
  @Roles(HR_ADMIN_ROLES)
  async approveAdjustment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.adjustments.approve(id, req.user.id, dto?.reason);
  }

  @Patch('adjustments/:id/reject')
  @Roles(HR_ADMIN_ROLES)
  async rejectAdjustment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.adjustments.reject(id, req.user.id, dto?.reason);
  }

  @Get('adjustments/:id/audit')
  @Roles(HR_ADMIN_ROLES)
  async adjustmentAuditHistory(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.audit.history(
      await this.orgId(organizationId),
      'PAYROLL_ADJUSTMENT',
      id,
    );
  }

  // ─── Employee Statutory / Payroll Overrides ────────────────────────────
  @Get('overrides/:userId')
  @Roles(HR_ADMIN_ROLES)
  async getEmployeeOverrides(@Param('userId') userId: string) {
    return this.overrides.getOverrides(userId);
  }

  @Patch('overrides/:userId')
  @Roles(STATUTORY_ADMIN_ROLES)
  async updateEmployeeOverrides(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { reason, ...rest } = dto ?? {};
    return this.overrides.updateStatutoryOverrides(
      userId,
      await this.orgId(organizationId),
      rest,
      req.user.id,
      reason,
    );
  }

  @Patch('overrides/component/:assignmentId')
  @Roles(STATUTORY_ADMIN_ROLES)
  async updateComponentOverride(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    const { reason, ...rest } = dto ?? {};
    return this.overrides.updateComponentOverride(
      assignmentId,
      await this.orgId(organizationId),
      rest,
      req.user.id,
      reason,
    );
  }

  @Get('overrides/:userId/audit')
  @Roles(HR_ADMIN_ROLES)
  async employeeOverrideAuditHistory(
    @Param('userId') userId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    // Entity id for EMPLOYEE_OVERRIDE audit rows is the EmployeeSalary row id,
    // not the userId — look it up first so callers only need the employee.
    const overrides = await this.overrides.getOverrides(userId);
    if (!overrides.statutory) return [];
    return this.audit.history(
      await this.orgId(organizationId),
      'EMPLOYEE_OVERRIDE',
      overrides.statutory.id,
    );
  }

  // ─── Audit History (general browse view) ───────────────────────────────
  @Get('audit')
  @Roles(HR_ADMIN_ROLES)
  async browseAuditLog(
    @Query('organizationId') organizationId: string | undefined,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.audit.listAll(await this.orgId(organizationId), {
      entityType: entityType as any,
      action: action as any,
      actorId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
  }

  // ─── Migration (legacy fields -> dynamic components) ────────────────────
  @Get('migration/status')
  @Roles(HR_ADMIN_ROLES)
  async migrationStatus(@Query('organizationId') organizationId?: string) {
    return this.migration.getMigrationStatus(await this.orgId(organizationId));
  }

  @Post('migration/run')
  @Roles(STATUTORY_ADMIN_ROLES)
  async runMigration(
    @Req() req: any,
    @Body() dto: any,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.migration.migrateOrganization(
      await this.orgId(organizationId),
      req.user.id,
      dto?.reason,
    );
  }

  // ─── Payroll Run Workflow ───────────────────────────────────────────────
  @Post('runs/:id/calculate')
  @Roles(HR_ADMIN_ROLES)
  async calculateRun(@Req() req: any, @Param('id') id: string) {
    return this.workflow.calculate(id, req.user.id);
  }

  @Post('runs/:id/review')
  @Roles(HR_ADMIN_ROLES)
  async reviewRun(@Param('id') id: string) {
    return this.workflow.review(id);
  }

  @Post('runs/:id/approve')
  @Roles(HR_ADMIN_ROLES)
  async approveRun(@Req() req: any, @Param('id') id: string) {
    return this.workflow.approve(id, req.user.id);
  }

  @Post('runs/:id/finalize')
  @Roles(HR_ADMIN_ROLES)
  async finalizeRun(@Req() req: any, @Param('id') id: string) {
    return this.workflow.finalize(id, req.user.id);
  }

  @Post('runs/:id/lock')
  @Roles(STATUTORY_ADMIN_ROLES)
  async lockRun(@Req() req: any, @Param('id') id: string) {
    return this.workflow.lock(id, req.user.id);
  }

  // ─── Payroll Audit History ─────────────────────────────────────────────
  @Get('audit')
  @Roles(HR_ADMIN_ROLES)
  async listAudit(
    @Query('organizationId') organizationId?: string,
    @Query('entityType') entityType?: any,
    @Query('action') action?: any,
    @Query('actorId') actorId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.listAll(
      await this.orgId(organizationId),
      {
        entityType,
        action,
        actorId,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      },
      limit ? parseInt(limit, 10) : 100,
    );
  }
}
