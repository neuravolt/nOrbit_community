import { Module } from '@nestjs/common';
import { CompanyProfileService } from './company-profile.service';
import { CompanyProfileController } from './company-profile.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CompanyProfileService],
  controllers: [CompanyProfileController],
  exports: [CompanyProfileService],
})
export class CompanyProfileModule {}
