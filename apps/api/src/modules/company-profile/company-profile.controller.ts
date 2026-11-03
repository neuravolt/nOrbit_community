import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CompanyProfileService } from './company-profile.service';
import { UpsertCompanyProfileDto } from './dto/upsert-company-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';

// Bank/UPI details and payment-gateway secrets live here, so writes are limited to the
// roles that can open Settings in the admin app (Sidebar: SUPER_ADMIN, MANAGER).
const PROFILE_WRITE_ROLES = ['SUPER_ADMIN', 'MANAGER'];

@Controller('company-profile')
export class CompanyProfileController {
  constructor(private readonly companyProfileService: CompanyProfileService) {}

  private getOrgId(req: any): string | null {
    const user = req?.user;
    if (user?.userType === 'CUSTOMER') {
      return user.activeOrganizationId || null;
    }
    return null;
  }

  @Get('public')
  async getPublic(@Query('organizationId') organizationId?: string) {
    const profile = await this.companyProfileService.get(organizationId || null);
    return {
      companyName: profile.companyName,
      logoUrl: profile.logoUrl,
      website: profile.website,
      faviconUrl: profile.faviconUrl,
      legalName: profile.legalName,
      bankName: profile.bankName,
      accountNumber: profile.accountNumber,
      ifscCode: profile.ifscCode,
      accountHolderName: profile.accountHolderName,
      upiId: profile.upiId,
      // Razorpay is disabled in favor of Cashfree.
      paymentGateway: 'CASHFREE',
      razorpayKeyId: null,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async get(@Req() req: any) {
    const profile = await this.companyProfileService.get(this.getOrgId(req));
    const {
      razorpayKeySecretEnc,
      cashfreeSecretKeyEnc,
      cashfreeWebhookSecretEnc,
      cashfreeSandboxSecretKeyEnc,
      cashfreeSandboxWebhookSecretEnc,
      cashfreeProductionSecretKeyEnc,
      cashfreeProductionWebhookSecretEnc,
      ...safe
    } = profile as any;
    return {
      ...safe,
      razorpaySecretConfigured: !!razorpayKeySecretEnc,
      cashfreeSecretConfigured: !!cashfreeSecretKeyEnc,
      cashfreeWebhookSecretConfigured: !!cashfreeWebhookSecretEnc,
      cashfreeSandboxSecretConfigured: !!cashfreeSandboxSecretKeyEnc,
      cashfreeSandboxWebhookSecretConfigured: !!cashfreeSandboxWebhookSecretEnc,
      cashfreeProductionSecretConfigured: !!cashfreeProductionSecretKeyEnc,
      cashfreeProductionWebhookSecretConfigured:
        !!cashfreeProductionWebhookSecretEnc,
    };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PROFILE_WRITE_ROLES)
  async upsert(@Body() dto: UpsertCompanyProfileDto, @Req() req: any) {
    const profile = await this.companyProfileService.upsert(dto, this.getOrgId(req));
    const {
      razorpayKeySecretEnc,
      cashfreeSecretKeyEnc,
      cashfreeWebhookSecretEnc,
      cashfreeSandboxSecretKeyEnc,
      cashfreeSandboxWebhookSecretEnc,
      cashfreeProductionSecretKeyEnc,
      cashfreeProductionWebhookSecretEnc,
      ...safe
    } = profile as any;
    return {
      ...safe,
      razorpaySecretConfigured: !!razorpayKeySecretEnc,
      cashfreeSecretConfigured: !!cashfreeSecretKeyEnc,
      cashfreeWebhookSecretConfigured: !!cashfreeWebhookSecretEnc,
      cashfreeSandboxSecretConfigured: !!cashfreeSandboxSecretKeyEnc,
      cashfreeSandboxWebhookSecretConfigured: !!cashfreeSandboxWebhookSecretEnc,
      cashfreeProductionSecretConfigured: !!cashfreeProductionSecretKeyEnc,
      cashfreeProductionWebhookSecretConfigured:
        !!cashfreeProductionWebhookSecretEnc,
    };
  }

  @Post('logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PROFILE_WRITE_ROLES)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.STORAGE_PATH || './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `logo-${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadLogo(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('File is required');
    const url = `/uploads/${file.filename}`;
    return this.companyProfileService.upsert({ logoUrl: url } as any, this.getOrgId(req));
  }

  @Post('favicon')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PROFILE_WRITE_ROLES)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.STORAGE_PATH || './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `fav-${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  async uploadFavicon(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('File is required');
    const url = `/uploads/${file.filename}`;
    return this.companyProfileService.upsert({ faviconUrl: url } as any, this.getOrgId(req));
  }

  @Post('signature')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PROFILE_WRITE_ROLES)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.STORAGE_PATH || './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `sig-${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  async uploadSignature(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('File is required');
    const url = `/uploads/${file.filename}`;
    return this.companyProfileService.upsert({ signatureUrl: url } as any, this.getOrgId(req));
  }

  @Post('stamp')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PROFILE_WRITE_ROLES)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.STORAGE_PATH || './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `stamp-${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  async uploadStamp(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('File is required');
    const url = `/uploads/${file.filename}`;
    return this.companyProfileService.upsert({ stampUrl: url } as any, this.getOrgId(req));
  }
}
