import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { EmployeeLifecycleService } from './employee-lifecycle.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PdfModule } from '../../common/pdf/pdf.module';
import { CompanyProfileModule } from '../company-profile/company-profile.module';

@Module({
  imports: [PrismaModule, PdfModule, CompanyProfileModule],
  controllers: [HrController],
  providers: [HrService, EmployeeLifecycleService],
  exports: [HrService],
})
export class HrModule {}
