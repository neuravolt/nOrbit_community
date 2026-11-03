import { Module } from '@nestjs/common';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplatesService } from './email-templates.service';
import { PrismaModule } from '../../common';
import { CompanyProfileModule } from '../company-profile/company-profile.module';

@Module({
  imports: [PrismaModule, CompanyProfileModule],
  controllers: [EmailTemplatesController],
  providers: [EmailTemplatesService],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
