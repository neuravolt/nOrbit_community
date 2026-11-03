import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  UseGuards,
  Req,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { HrService } from './hr.service';
import { EmployeeLifecycleService } from './employee-lifecycle.service';
import { officeDate } from './shift.policy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import {
  UpdateEmploymentTypeDto,
  GenerateHrDocumentDto,
  LogAttendanceDto,
  CreateLeaveRequestDto,
  UpdateLeaveStatusDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from './dto';
import { EmploymentType, HrDocumentType, LeaveStatus } from '@prisma/client';

const HR_ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER', 'CO_FOUNDER', 'ADMIN'];

// Helper: checks if req.user has admin-level access
function isHrAdmin(user: any): boolean {
  const role = (user?.role || '').toUpperCase();
  return HR_ADMIN_ROLES.some((r) => r === role);
}

@Controller('hr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HrController {
  constructor(
    private readonly hrService: HrService,
    private readonly lifecycle: EmployeeLifecycleService,
  ) {}

  // ─── Employee Directory ───────────────────────────────────────────────────

  @Get('employees')
  @Roles(HR_ADMIN_ROLES)
  listEmployees(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('type') type?: EmploymentType,
  ) {
    return this.hrService.listEmployees({ search, type }, req.user);
  }

  @Patch('employees/:id/type')
  @Roles(HR_ADMIN_ROLES)
  updateEmploymentType(
    @Param('id') id: string,
    @Body() dto: UpdateEmploymentTypeDto,
  ) {
    return this.hrService.updateEmploymentType(id, dto.employmentType);
  }

  @Post('employees')
  @HttpCode(201)
  @Roles(HR_ADMIN_ROLES)
  createEmployee(@Body() dto: CreateEmployeeDto, @Req() req: any) {
    return this.hrService.createEmployee(dto, req.user);
  }

  @Post('employees/:id/invite')
  @HttpCode(200)
  @Roles(HR_ADMIN_ROLES)
  resendInvite(@Param('id') id: string) {
    return this.hrService.resendInvite(id);
  }

  @Patch('employees/:id')
  @Roles(HR_ADMIN_ROLES)
  updateEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.hrService.updateEmployee(id, dto);
  }

  @Delete('employees/:id')
  @Roles(HR_ADMIN_ROLES)
  deleteEmployee(@Param('id') id: string) {
    return this.hrService.deleteEmployee(id);
  }

  @Delete('employees/:id/permanent')
  @Roles(['SUPER_ADMIN'])
  permanentDeleteEmployee(@Param('id') id: string) {
    return this.hrService.permanentDeleteEmployee(id);
  }

  // ─── Joining / exit checklists and shift roster ────────────────────────────

  @Get('lifecycle')
  @Roles(HR_ADMIN_ROLES)
  lifecycleOverview() {
    return this.lifecycle.overview();
  }

  @Get('employees/:id/checklist')
  @Roles(HR_ADMIN_ROLES)
  employeeChecklist(@Param('id') id: string) {
    return this.lifecycle.checklist(id);
  }

  @Patch('employees/:id/checklist')
  @Roles(HR_ADMIN_ROLES)
  tickChecklist(
    @Param('id') id: string,
    @Body()
    dto: { kind: 'ONBOARDING' | 'OFFBOARDING'; key: string; done: boolean },
    @Req() req: any,
  ) {
    return this.lifecycle.tick(id, dto.kind, dto.key, dto.done, req.user);
  }

  @Post('employees/:id/exit')
  @HttpCode(200)
  @Roles(HR_ADMIN_ROLES)
  startExit(
    @Param('id') id: string,
    @Body() dto: { lastWorkingDay?: string; reason?: string; status?: string },
  ) {
    return this.lifecycle.startExit(id, dto);
  }

  @Patch('employees/:id/exit-interview')
  @Roles(HR_ADMIN_ROLES)
  saveExitInterview(@Param('id') id: string, @Body() dto: { notes: string }) {
    return this.lifecycle.saveExitInterview(id, dto?.notes);
  }

  @Post('employees/:id/disable-login')
  @HttpCode(200)
  @Roles(HR_ADMIN_ROLES)
  disableLogin(@Param('id') id: string, @Req() req: any) {
    return this.lifecycle.disableLogin(id, req.user.id);
  }

  @Get('roster')
  @Roles(HR_ADMIN_ROLES)
  roster() {
    return this.lifecycle.roster();
  }

  @Post('roster/assign')
  @HttpCode(200)
  @Roles(HR_ADMIN_ROLES)
  assignShift(
    @Body()
    dto: {
      userIds: string[];
      shiftName?: string;
      start: string;
      end: string;
      graceMins?: number;
      weeklyOff?: string[];
    },
  ) {
    return this.lifecycle.assignShift(dto);
  }

  // ─── Employee Self-Service (ESS) Endpoints ─────────────────────────────────

  @Get('me')
  getMyProfile(@Req() req: any) {
    return this.hrService.getMyProfile(req.user.id);
  }

  @Patch('my-profile')
  updateMyProfile(@Req() req: any, @Body() dto: UpdateEmployeeDto) {
    return this.hrService.updateEmployee(req.user.id, dto);
  }

  @Get('my-assets')
  getMyAssets(@Req() req: any) {
    return this.hrService.getMyAssets(req.user.id);
  }

  // ─── Documents Management ─────────────────────────────────────────────────

  @Get('documents')
  listDocuments(
    @Req() req: any,
    @Query('employeeId') employeeId?: string,
    @Query('type') type?: HrDocumentType,
  ) {
    const targetEmpId = isHrAdmin(req.user) ? employeeId : req.user.id;
    return this.hrService.listDocuments({ employeeId: targetEmpId, type });
  }

  // Generated PDFs are no longer served from the public /uploads static route (see main.ts);
  // this is the only way to fetch one.
  @Get('documents/:id/file')
  async downloadDocument(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { fullPath, fileName } = await this.hrService.getDocumentFileForUser(
      id,
      req.user,
      isHrAdmin(req.user),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(fullPath);
  }

  @Post('documents/generate')
  @HttpCode(201)
  @Roles(HR_ADMIN_ROLES)
  generateDocument(@Body() dto: GenerateHrDocumentDto) {
    return this.hrService.generateDocument(dto);
  }

  @Post('documents/:id/send')
  @HttpCode(200)
  @Roles(HR_ADMIN_ROLES)
  sendDocument(@Param('id') id: string) {
    return this.hrService.sendDocument(id);
  }

  @Delete('documents/:id')
  @Roles(HR_ADMIN_ROLES)
  deleteDocument(@Param('id') id: string) {
    return this.hrService.deleteDocument(id);
  }

  // ─── Attendance Register ──────────────────────────────────────────────────

  @Get('attendance/stats')
  getAttendanceStats(
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.hrService.getAttendanceStats({ date, startDate, endDate });
  }

  @Get('attendance')
  listAttendance(
    @Req() req: any,
    @Query('employeeId') employeeId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const targetEmpId = isHrAdmin(req.user) ? employeeId : req.user.id;
    const y = year ? parseInt(year, 10) : undefined;
    const m = month ? parseInt(month, 10) : undefined;
    return this.hrService.listAttendance({
      employeeId: targetEmpId,
      year: y,
      month: m,
      startDate,
      endDate,
      departmentId,
      branchId,
      status,
      search,
    });
  }

  @Post('attendance/log')
  @HttpCode(200)
  logAttendance(@Body() dto: LogAttendanceDto, @Req() req: any) {
    if (!isHrAdmin(req.user) && dto.employeeId !== req.user.id) {
      throw new ForbiddenException('You can only log attendance for yourself');
    }
    if (!isHrAdmin(req.user)) {
      // An employee's own punch is stamped with the server clock: no picking the time, day or status.
      if (!dto.clockIn && !dto.clockOut)
        throw new ForbiddenException(
          'Use check-in or check-out to mark attendance',
        );
      const now = new Date();
      dto = {
        ...dto,
        date: officeDate(now),
        clockIn: dto.clockIn ? now.toISOString() : undefined,
        clockOut: dto.clockIn ? undefined : now.toISOString(),
        status: 'PRESENT',
      };
    }
    return this.hrService.logAttendance(dto, dto.employeeId === req.user.id);
  }

  @Delete('attendance/:id')
  deleteAttendance(@Param('id') id: string, @Req() req: any) {
    if (!isHrAdmin(req.user)) {
      throw new ForbiddenException(
        'Only HR Admins can delete attendance records',
      );
    }
    return this.hrService.deleteAttendance(id);
  }

  @Patch('attendance/:id/review')
  @Roles(HR_ADMIN_ROLES)
  reviewAttendance(
    @Param('id') id: string,
    @Body() dto: { decision: 'APPROVED' | 'DENIED'; note?: string },
    @Req() req: any,
  ) {
    return this.hrService.reviewAttendance(
      id,
      dto.decision,
      req.user.id,
      dto.note,
    );
  }

  // ─── Leave Requests & V4 Engine ───────────────────────────────────────────

  @Get('leaves')
  listLeaves(
    @Req() req: any,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: LeaveStatus,
  ) {
    const targetEmpId = isHrAdmin(req.user) ? employeeId : req.user.id;
    return this.hrService.listLeaves({ employeeId: targetEmpId, status });
  }

  @Post('leaves')
  @HttpCode(201)
  createLeave(@Body() dto: CreateLeaveRequestDto, @Req() req: any) {
    if (!isHrAdmin(req.user) && dto.employeeId !== req.user.id) {
      throw new ForbiddenException(
        'You do not have permission to request leaves for other users',
      );
    }
    return this.hrService.createLeave(dto);
  }

  @Patch('leaves/:id/status')
  @Roles(HR_ADMIN_ROLES)
  updateLeaveStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveStatusDto,
    @Req() req: any,
  ) {
    return this.hrService.updateLeaveStatus(id, dto, req.user.id);
  }

  @Get('leave-balances')
  getLeaveBalances(@Req() req: any, @Query('employeeId') employeeId?: string) {
    const targetId =
      isHrAdmin(req.user) && employeeId ? employeeId : req.user.id;
    return this.hrService.getLeaveBalances(targetId);
  }

  @Get('leave-ledger')
  getLeaveLedger(@Req() req: any, @Query('employeeId') employeeId?: string) {
    const targetId =
      isHrAdmin(req.user) && employeeId ? employeeId : req.user.id;
    return this.hrService.getLeaveLedger(targetId);
  }

  @Post('leave-adjustment')
  @Roles(HR_ADMIN_ROLES)
  createManualLedgerAdjustment(@Body() dto: any, @Req() req: any) {
    return this.hrService.createManualLedgerAdjustment({
      ...dto,
      adminUserId: req.user.id,
    });
  }

  @Get('holidays')
  listCompanyHolidays(@Query('year') year?: string) {
    return this.hrService.listCompanyHolidays(year ? Number(year) : undefined);
  }

  @Post('holidays')
  @Roles(HR_ADMIN_ROLES)
  createCompanyHoliday(@Body() dto: any) {
    return this.hrService.createCompanyHoliday(dto);
  }

  @Delete('holidays/:id')
  @Roles(HR_ADMIN_ROLES)
  deleteCompanyHoliday(@Param('id') id: string) {
    return this.hrService.deleteCompanyHoliday(id);
  }

  @Get('leave-policies')
  listLeavePolicies() {
    return this.hrService.listLeavePolicies();
  }

  @Post('leave-policies')
  @Roles(HR_ADMIN_ROLES)
  createLeavePolicy(@Body() dto: any) {
    return this.hrService.createLeavePolicy(dto);
  }

  @Post('employee-leave-policies')
  @Roles(HR_ADMIN_ROLES)
  assignEmployeeLeavePolicy(@Body() dto: any, @Req() req: any) {
    return this.hrService.assignEmployeeLeavePolicy({
      ...dto,
      adminUserId: req.user.id,
    });
  }

  @Get('approval-delegations')
  listApprovalDelegations(@Query('delegatorId') delegatorId?: string) {
    return this.hrService.listApprovalDelegations(delegatorId);
  }

  @Post('approval-delegations')
  createApprovalDelegation(@Body() dto: any, @Req() req: any) {
    return this.hrService.createApprovalDelegation({
      ...dto,
      delegatorId:
        isHrAdmin(req.user) && dto.delegatorId ? dto.delegatorId : req.user.id,
    });
  }
}
