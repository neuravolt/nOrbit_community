import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import {
  PermissionsGuard,
  Permissions,
} from '../roles/guards/permissions.guard';
import { PdfService } from '../../common/pdf/pdf.service';
import type { Response } from 'express';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly pdfService: PdfService,
  ) {}

  @Post()
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['invoice:create'])
  create(@Body() dto: any, @Req() req: any) {
    return this.billingService.create(dto, req?.user);
  }

  @Post('from-quote/:quoteId')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['invoice:create'])
  createFromQuote(@Param('quoteId') quoteId: string) {
    return this.billingService.createFromQuote(quoteId);
  }

  @Post('from-amc/:contractId')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['invoice:create'])
  createFromAmc(@Param('contractId') contractId: string) {
    return this.billingService.createAmcInvoice(contractId);
  }

  @Post('from-time-logs')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['invoice:create'])
  createFromTimeLogs(@Body() dto: { projectId: string; clientId: string }) {
    return this.billingService.createFromTimeLogs(dto.projectId, dto.clientId);
  }

  @Get()
  @Roles(['SUPER_ADMIN', 'MANAGER', 'EMPLOYEE', 'SALES', 'SUPPORT'])
  @Permissions(['invoice:read'])
  findAll(@Query() query: any, @Req() req: any) {
    return this.billingService.findAll(query, req?.user);
  }

  @Get('overdue')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'EMPLOYEE', 'SALES'])
  @Permissions(['invoice:read'])
  getOverdue(@Req() req: any) {
    return this.billingService.getOverdue(req?.user);
  }

  @Get(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'EMPLOYEE', 'SALES', 'SUPPORT'])
  @Permissions(['invoice:read'])
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.billingService.findOne(id, req?.user);
  }

  @Patch(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['invoice:update'])
  update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.billingService.update(id, dto, req?.user);
  }

  @Patch(':id/send')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['invoice:update'])
  send(@Param('id') id: string, @Req() req: any) {
    return this.billingService.send(id, req?.user);
  }

  @Patch(':id/record-payment')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['invoice:update'])
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.STORAGE_PATH || './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `receipt-${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  recordPayment(
    @Param('id') id: string,
    @Body() dto: any,
    @UploadedFile() file?: Express.Multer.File,
    @Req() req?: any,
  ) {
    if (file) {
      dto.receiptUrl = `/uploads/${file.filename}`;
    }
    if (typeof dto.amount === 'string') {
      dto.amount = parseFloat(dto.amount);
    }
    return this.billingService.recordPayment(id, dto, req?.user);
  }

  @Get(':id/pdf')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'EMPLOYEE', 'SALES', 'SUPPORT'])
  @Permissions(['invoice:read'])
  async downloadPdf(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    try {
      await this.billingService.findOne(id, req?.user);
      const buffer = await this.pdfService.generateInvoicePdf(id);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (err: any) {
      res
        .status(err.status || 500)
        .json({ message: err?.message ?? 'PDF generation failed' });
    }
  }

  @Patch(':id/rollback')
  @Roles(['SUPER_ADMIN'])
  @Permissions(['invoice:delete'])
  rollback(@Param('id') id: string, @Req() req: any) {
    return this.billingService.rollback(id, req?.user);
  }

  @Patch(':id/rollback-to-draft')
  @Roles(['SUPER_ADMIN'])
  @Permissions(['invoice:delete'])
  rollbackToDraft(@Param('id') id: string, @Req() req: any) {
    return this.billingService.rollback(id, req?.user);
  }

  @Post(':id/resend')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['invoice:update'])
  resend(@Param('id') id: string, @Req() req: any) {
    return this.billingService.resend(id, req?.user);
  }

  @Delete(':id')
  @Roles(['SUPER_ADMIN'])
  @Permissions(['invoice:delete'])
  delete(@Param('id') id: string, @Req() req: any) {
    return this.billingService.delete(id, req?.user);
  }

  @Post('send-overdue-reminders')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['invoice:update'])
  sendOverdueReminders(@Req() req: any) {
    return this.billingService.sendOverdueReminders(req?.user);
  }
}
