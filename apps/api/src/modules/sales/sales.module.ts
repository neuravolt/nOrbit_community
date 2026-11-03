import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SalesRepository } from './sales.repository';
import { CompanyProfileModule } from '../company-profile/company-profile.module';
import { PdfModule } from '../../common/pdf/pdf.module';

@Module({
  imports: [PrismaModule, CompanyProfileModule, PdfModule],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository],
  exports: [SalesService, SalesRepository],
})
export class SalesModule {}
