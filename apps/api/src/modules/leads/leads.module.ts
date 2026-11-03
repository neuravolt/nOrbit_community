import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadsRepository } from './leads.repository';
import { LeadsApiKeyGuard } from './guards/leads-api-key.guard';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [PrismaModule, ClientsModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadsRepository, LeadsApiKeyGuard],
  exports: [LeadsService, LeadsRepository],
})
export class LeadsModule {}
