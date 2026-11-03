import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('weekly')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  getWeeklySummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getWeeklySummary(startDate, endDate);
  }

  @Get('team-productivity')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  getTeamProductivity(
    @Query('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getTeamProductivity(userId, startDate, endDate);
  }

  @Get('project-progress')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'DEVELOPER', 'QA'])
  getProjectProgress(@Query('projectId') projectId: string) {
    return this.reportsService.getProjectProgress(projectId);
  }

  @Get('amc-health')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'SALES'])
  getAmcHealth(@Query('contractId') contractId: string) {
    // Without a contract: the whole AMC portfolio (the Reports page). With one: that contract.
    if (!contractId) return this.reportsService.getAmcPortfolioHealth();
    return this.reportsService.getAmcHealth(contractId);
  }
}
