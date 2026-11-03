import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AmcController } from './amc.controller';
import { AmcService } from './amc.service';
import { AmcRepository } from './amc.repository';
import { AmcWeeklyReportService } from './amc-weekly-report.service';
import { CompanyProfileModule } from '../company-profile/company-profile.module';
import { PdfModule } from '../../common/pdf/pdf.module';

@Module({
  imports: [PrismaModule, CompanyProfileModule, PdfModule],
  controllers: [AmcController],
  providers: [AmcService, AmcRepository, AmcWeeklyReportService],
  exports: [AmcService, AmcRepository, AmcWeeklyReportService],
})
export class AmcModule {}
