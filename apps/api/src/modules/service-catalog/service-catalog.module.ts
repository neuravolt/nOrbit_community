import { Module } from '@nestjs/common';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceCatalogController } from './service-catalog.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ServiceCatalogService],
  controllers: [ServiceCatalogController],
  exports: [ServiceCatalogService],
})
export class ServiceCatalogModule {}
