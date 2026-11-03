import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Header,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PdfService } from '../../common/pdf/pdf.service';
import { ManualPaymentsService } from '../billing/manual-payments.service';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly pdfService: PdfService,
    private readonly manualPaymentsService: ManualPaymentsService,
  ) {}

  /**
   * Cashfree Webhook endpoint for server-to-server notifications.
   * Public endpoint, protected by cryptographic HMAC-SHA256 signature verification.
   */
  @Post('cashfree/webhook')
  @HttpCode(HttpStatus.OK)
  async handleCashfreeWebhook(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
  ) {
    const rawBody =
      req.rawBody ||
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    return this.paymentsService.processCashfreeWebhook(rawBody, headers);
  }

  /**
   * Public Hosted Pay Endpoint: Fetch invoice summary and company payment config.
   * Allows 1-click unauthenticated payment directly from email link.
   */
  @Get('public/invoice/:id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getPublicInvoice(@Param('id') id: string) {
    return this.paymentsService.getPublicInvoice(id);
  }

  /**
   * Public Hosted Pay Endpoint: Create a Cashfree checkout session without requiring portal login.
   */
  @Post('public/invoice/:id/session')
  async createPublicOnlinePaymentSession(@Param('id') id: string) {
    return this.paymentsService.createPublicOnlinePaymentSession(id);
  }

  /**
   * Public Hosted Pay Endpoint: Download official invoice PDF without requiring portal login.
   */
  @Get('public/invoice/:id/pdf')
  async downloadPublicInvoicePdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    try {
      const buffer = await this.pdfService.generateInvoicePdf(id);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (err: any) {
      res
        .status(500)
        .json({ message: err?.message ?? 'PDF generation failed' });
    }
  }

  /**
   * Public Hosted Pay Endpoint: Submit manual payment UTR & proof screenshot.
   */
  @Post('public/invoice/:id/manual-payment')
  @UseInterceptors(
    FileInterceptor('proof', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async submitPublicManualPayment(
    @Param('id') id: string,
    @Body() dto: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.manualPaymentsService.submitPublicManualPayment(id, dto, file);
  }

  /**
   * Public Hosted Pay Endpoint: Synchronize & verify Cashfree order status on return or modal close.
   */
  @Post('public/invoice/:id/sync/:orderId')
  async syncPublicOrder(
    @Param('id') id: string,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.syncPublicOrder(id, orderId);
  }
}
