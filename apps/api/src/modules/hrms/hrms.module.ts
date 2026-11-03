import { Module } from '@nestjs/common';
import { HrmsController } from './hrms.controller';
import { HrmsService } from './hrms.service';
import { PayrollConfigService } from './services/payroll-config.service';
import { PayrollController } from './payroll/payroll.controller';
import { SalaryComponentService } from './payroll/salary-component.service';
import { HolidayCalendarService } from './payroll/holiday-calendar.service';
import { WorkingWeekService } from './payroll/working-week.service';
import { TaxConfigService } from './payroll/tax-config.service';
import { PayrollAdjustmentService } from './payroll/payroll-adjustment.service';
import { PayrollWorkflowService } from './payroll/payroll-workflow.service';
import { PayrollAuditService } from './payroll/payroll-audit.service';
import { EmployeeOverrideService } from './payroll/employee-override.service';
import { PayrollMigrationService } from './payroll/payroll-migration.service';
import { StatutoryExportsService } from './payroll/statutory-exports.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HrmsController, PayrollController],
  providers: [
    HrmsService,
    PayrollConfigService,
    PayrollAuditService,
    SalaryComponentService,
    HolidayCalendarService,
    WorkingWeekService,
    TaxConfigService,
    PayrollAdjustmentService,
    PayrollWorkflowService,
    EmployeeOverrideService,
    PayrollMigrationService,
    StatutoryExportsService,
  ],
  exports: [HrmsService, PayrollConfigService],
})
export class HrmsModule {}
