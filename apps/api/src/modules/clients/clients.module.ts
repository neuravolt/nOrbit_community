import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { ClientPortalController } from './client-portal.controller';
import { ClientsRepository } from './clients.repository';
import { ClientPortalService } from './client-portal.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PdfModule } from '../../common/pdf/pdf.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';
import { BillingModule } from '../billing/billing.module';
import { CompanyProfileModule } from '../company-profile/company-profile.module';
import { GuardianModule } from '../guardian/guardian.module';

@Module({
  imports: [
    PrismaModule,
    PdfModule,
    NotificationsModule,
    UploadsModule,
    BillingModule,
    CompanyProfileModule,
    GuardianModule,
  ],
  controllers: [ClientsController, ClientPortalController],
  providers: [ClientsService, ClientsRepository, ClientPortalService],
  exports: [ClientsService, ClientsRepository, ClientPortalService],
})
export class ClientsModule {}
