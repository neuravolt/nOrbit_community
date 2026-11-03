import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { ManualPaymentsController } from './manual-payments.controller';
import { ManualPaymentsService } from './manual-payments.service';
import { CompanyProfileModule } from '../company-profile/company-profile.module';
import { PdfModule } from '../../common/pdf/pdf.module';

@Module({
  imports: [PrismaModule, CompanyProfileModule, PdfModule],
  controllers: [BillingController, ManualPaymentsController],
  providers: [BillingService, ManualPaymentsService],
  exports: [BillingService, ManualPaymentsService],
})
export class BillingModule {}
