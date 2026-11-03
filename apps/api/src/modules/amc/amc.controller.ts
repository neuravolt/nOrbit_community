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
  Res,
} from '@nestjs/common';
import { AmcService } from './amc.service';
import { AmcWeeklyReportService } from './amc-weekly-report.service';
import { PdfService } from '../../common/pdf/pdf.service';
import {
  CreateAmcContractDto,
  UpdateAmcContractDto,
  RenewAmcContractDto,
  LogAmcHoursDto,
  ListAmcContractsQuery,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import type { Response } from 'express';

const MANAGEMENT_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CO_FOUNDER',
  'MANAGER',
  'ACCOUNTANT',
];
const ALL_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CO_FOUNDER',
  'MANAGER',
  'ACCOUNTANT',
  'DEVELOPER',
  'QA',
  'EMPLOYEE',
];

@Controller('amc-contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AmcController {
  constructor(
    private readonly amcService: AmcService,
    private readonly amcWeeklyReportService: AmcWeeklyReportService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  @Roles(ALL_ROLES)
  async listContracts(@Query() query: ListAmcContractsQuery, @Req() req: any) {
    return this.amcService.listContracts(query, req.user);
  }

  @Get('renewals/due')
  @Roles(ALL_ROLES)
  async getRenewalsDue(@Query('days') days?: string, @Req() req?: any) {
    const daysThreshold = days ? parseInt(days, 10) : 30;
    return this.amcService.getRenewalsDue(daysThreshold, req?.user);
  }

  @Post()
  @Roles(MANAGEMENT_ROLES)
  @HttpCode(201)
  async createContract(
    @Body() createAmcDto: CreateAmcContractDto,
    @Req() req: any,
  ) {
    return this.amcService.createContract(createAmcDto, req.user);
  }

  @Get(':id')
  @Roles(ALL_ROLES)
  async getContract(@Param('id') id: string) {
    return this.amcService.getContract(id);
  }

  @Patch(':id')
  @Roles(MANAGEMENT_ROLES)
  async updateContract(
    @Param('id') id: string,
    @Body() updateAmcDto: UpdateAmcContractDto,
    @Req() req: any,
  ) {
    const user = req.user;
    return this.amcService.updateContract(id, updateAmcDto, user);
  }

  @Patch(':id/renew')
  @Roles(MANAGEMENT_ROLES)
  async renewContract(
    @Param('id') id: string,
    @Body() renewAmcDto: RenewAmcContractDto,
  ) {
    return this.amcService.renewContract(id, renewAmcDto);
  }

  @Post(':id/log-hours')
  @Roles(ALL_ROLES)
  @HttpCode(201)
  async logHours(
    @Param('id') id: string,
    @Body() logAmcHoursDto: LogAmcHoursDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id ?? req.user?.sub ?? 'default-user-id';
    return this.amcService.logHours(id, userId, logAmcHoursDto);
  }

  @Get(':id/hours')
  @Roles(ALL_ROLES)
  async getHourLogs(@Param('id') id: string) {
    return this.amcService.getHourLogs(id);
  }

  // ── Weekly Reports ────────────────────────────────────────────────────────

  @Post(':id/weekly-reports/generate')
  @Roles(MANAGEMENT_ROLES)
  @HttpCode(201)
  async generateWeeklyReport(
    @Param('id') id: string,
    @Body()
    body: {
      periodStart?: string;
      periodEnd?: string;
      forceRegenerate?: boolean;
      includeHours?: boolean;
    },
    @Req() req: any,
  ) {
    const compiledById = req.user?.id ?? req.user?.sub ?? 'default-user-id';
    const periodStart = body.periodStart
      ? new Date(body.periodStart)
      : undefined;
    const periodEnd = body.periodEnd ? new Date(body.periodEnd) : undefined;
    return this.amcWeeklyReportService.generateReport(
      id,
      compiledById,
      periodStart,
      periodEnd,
      body.forceRegenerate,
      body.includeHours ?? false,
    );
  }

  @Get(':id/weekly-reports')
  @Roles(ALL_ROLES)
  async listWeeklyReports(@Param('id') id: string) {
    return this.amcWeeklyReportService.listReports(id);
  }

  @Get('weekly-reports/:reportId')
  @Roles(ALL_ROLES)
  async getWeeklyReport(@Param('reportId') reportId: string) {
    return this.amcWeeklyReportService.getReport(reportId);
  }

  @Patch('weekly-reports/:reportId')
  @Roles(MANAGEMENT_ROLES)
  async updateWeeklyReport(
    @Param('reportId') reportId: string,
    @Body() dto: any,
  ) {
    return this.amcWeeklyReportService.updateReport(reportId, dto);
  }

  @Get('weekly-reports/:reportId/pdf')
  @Roles(ALL_ROLES)
  async downloadReportPdf(
    @Param('reportId') reportId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.pdfService.generateAmcReportPdf(reportId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="amc-report-${reportId}.pdf"`,
    });
    res.send(buffer);
  }

  // ── Delete / Restore ─────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(MANAGEMENT_ROLES)
  @HttpCode(204)
  async deleteContract(@Param('id') id: string) {
    return this.amcService.deleteContract(id);
  }

  @Patch(':id/restore')
  @Roles(MANAGEMENT_ROLES)
  async restoreContract(@Param('id') id: string) {
    return this.amcService.restoreContract(id);
  }
}
