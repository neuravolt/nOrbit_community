import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CompanyProfileModule } from '../../modules/company-profile/company-profile.module';

@Module({
  imports: [PrismaModule, CompanyProfileModule],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
