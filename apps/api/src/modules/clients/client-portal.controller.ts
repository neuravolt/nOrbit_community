import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  Res,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  HttpCode,
} from '@nestjs/common';
import { ClientPortalService } from './client-portal.service';
import { ClientJwtAuthGuard } from '../auth/guards/client-jwt-auth.guard';
import { PdfService } from '../../common/pdf/pdf.service';
import { UploadsService } from '../uploads/uploads.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import type { Response } from 'express';

import { PaymentConfigService } from '../payments/payment-config.service';
import { PaymentsService } from '../payments/payments.service';
import { ManualPaymentsService } from '../billing/manual-payments.service';
import { SubmitManualPaymentDto } from '../billing/dto/manual-payment.dto';

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword', // doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
];

@Controller('client-portal')
@UseGuards(ClientJwtAuthGuard)
export class ClientPortalController {
  constructor(
    private readonly clientPortalService: ClientPortalService,
    private readonly pdfService: PdfService,
    private readonly uploadsService: UploadsService,
    private readonly paymentConfigService: PaymentConfigService,
    private readonly paymentsService: PaymentsService,
    private readonly manualPaymentsService: ManualPaymentsService,
  ) {}

  @Get('payment-config')
  getPaymentConfig() {
    return this.paymentConfigService.getPaymentConfig();
  }

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.clientPortalService.getDashboardStats(req.user.clientId);
  }

  @Get('hosting')
  getHostingData(@Req() req: any) {
    return this.clientPortalService.getHostingData(req.user.clientId);
  }

  // BYOVPS self-service onboarding — see GUARDIAN_BYOVPS_PLAN.md section 3d.
  // Clients can only Generate Install Command / Reinstall / view status for
  // BYOVPS assets they own. Disable, Rotate Secret, and viewing the agent
  // secret/fingerprint/audit logs remain admin-only (Fleet UI, not exposed here).

  @Get('guardian/byovps/:assetId/status')
  getByovpsOnboardingStatus(
    @Req() req: any,
    @Param('assetId') assetId: string,
  ) {
    return this.clientPortalService.getByovpsOnboardingStatus(
      req.user.clientId,
      assetId,
    );
  }

  @Post('guardian/byovps/:assetId/install-command')
  generateByovpsInstallCommand(
    @Req() req: any,
    @Param('assetId') assetId: string,
  ) {
    return this.clientPortalService.generateByovpsInstallCommand(
      req.user.clientId,
      assetId,
      req.user.id,
    );
  }

  // ── Guardian Client Self-Service Security Operations ────────────────────────

  @Get('guardian/:websiteId/alerts')
  getClientWebsiteAlertsList(
    @Req() req: any,
    @Param('websiteId') websiteId: string,
  ) {
    return this.clientPortalService.getClientWebsiteAlertsList(
      req.user.clientId,
      websiteId,
    );
  }

  @Post('guardian/:websiteId/alerts/:alertId/one-click-fix')
  oneClickFixClientAlert(
    @Req() req: any,
    @Param('websiteId') websiteId: string,
    @Param('alertId') alertId: string,
  ) {
    return this.clientPortalService.oneClickFixClientAlert(
      req.user.clientId,
      websiteId,
      alertId,
      req.user.email,
    );
  }

  @Get('guardian/:websiteId/quarantine-registry')
  getClientQuarantineRegistry(
    @Req() req: any,
    @Param('websiteId') websiteId: string,
    @Query('status') status?: string,
  ) {
    return this.clientPortalService.getClientQuarantineRegistry(
      req.user.clientId,
      websiteId,
      status,
    );
  }

  @Post('guardian/:websiteId/restore-file')
  restoreClientQuarantinedFile(
    @Req() req: any,
    @Param('websiteId') websiteId: string,
    @Body('recordId') recordId: string,
  ) {
    return this.clientPortalService.restoreClientQuarantinedFile(
      req.user.clientId,
      websiteId,
      recordId,
      req.user.email,
    );
  }

  @Get('projects')
  getProjects(@Req() req: any) {
    return this.clientPortalService.getProjects(req.user.clientId);
  }

  @Get('projects/:id')
  getProjectDetails(@Req() req: any, @Param('id') id: string) {
    return this.clientPortalService.getProjectDetails(req.user.clientId, id);
  }

  @Get('tickets')
  getTickets(@Req() req: any) {
    return this.clientPortalService.getTickets(req.user.clientId);
  }

  @Get('tickets/:id')
  getTicketDetails(@Req() req: any, @Param('id') id: string) {
    return this.clientPortalService.getTicketDetails(req.user.clientId, id);
  }

  @Post('tickets')
  createTicket(@Req() req: any, @Body() dto: any) {
    return this.clientPortalService.createTicket(req.user.clientId, dto);
  }

  @Post('tickets/:id/comments')
  addComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.clientPortalService.addTicketComment(
      req.user.clientId,
      id,
      req.user.id,
      content,
    );
  }

  @Get('quotes')
  getQuotes(@Req() req: any) {
    return this.clientPortalService.getQuotes(req.user.clientId);
  }

  @Get('quotes/:id')
  getQuoteDetails(@Req() req: any, @Param('id') id: string) {
    return this.clientPortalService.getQuoteDetails(req.user.clientId, id);
  }

  @Post('quotes/:id/accept')
  acceptQuote(@Req() req: any, @Param('id') id: string) {
    return this.clientPortalService.acceptQuote(req.user.clientId, id);
  }

  @Post('quotes/:id/reject')
  rejectQuote(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.clientPortalService.rejectQuote(req.user.clientId, id, reason);
  }

  @Get('quotes/:id/pdf')
  async downloadQuotePdf(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    // Verify client ownership first
    await this.clientPortalService.getQuoteDetails(req.user.clientId, id);
    const buffer = await this.pdfService.generateQuotationPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="quotation-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('invoices')
  getInvoices(@Req() req: any) {
    return this.clientPortalService.getInvoices(req.user.clientId);
  }

  @Get('invoices/:id')
  getInvoiceDetails(@Req() req: any, @Param('id') id: string) {
    return this.clientPortalService.getInvoiceDetails(req.user.clientId, id);
  }

  @Post('invoices/:id/online-payment/session')
  createOnlinePaymentSession(@Req() req: any, @Param('id') id: string) {
    return this.paymentsService.createOnlinePaymentSession(
      req.user.clientId,
      id,
    );
  }

  @Post('invoices/:id/manual-payment')
  @UseInterceptors(
    FileInterceptor('proof', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  submitManualPayment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitManualPaymentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.manualPaymentsService.submitManualPayment(
      req.user.clientId,
      id,
      dto,
      file,
    );
  }

  @Get('invoices/:id/manual-payments')
  getInvoiceManualPayments(@Req() req: any, @Param('id') id: string) {
    return this.manualPaymentsService.getInvoiceSubmissionsForClient(
      req.user.clientId,
      id,
    );
  }

  @Get('manual-payments/:id/proof')
  async getManualPaymentProof(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, filename, contentType } =
      await this.manualPaymentsService.getProofFile(id, {
        clientId: req.user.clientId,
      });

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
    });

    stream.pipe(res);
  }

  @Post('invoices/:id/razorpay/order')
  createRazorpayOrder() {
    throw new ForbiddenException('Razorpay is disabled in favor of Cashfree.');
  }

  @Post('invoices/:id/razorpay/verify')
  verifyRazorpayPayment() {
    throw new ForbiddenException('Razorpay is disabled in favor of Cashfree.');
  }

  @Get('invoices/:id/pdf')
  async downloadInvoicePdf(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    // Verify client ownership first
    await this.clientPortalService.getInvoiceDetails(req.user.clientId, id);
    const buffer = await this.pdfService.generateInvoicePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('amc')
  getAmcContracts(@Req() req: any) {
    return this.clientPortalService.getAmcContracts(req.user.clientId);
  }

  @Get('amc/:id')
  getAmcContractDetails(@Req() req: any, @Param('id') id: string) {
    return this.clientPortalService.getAmcContractDetails(
      req.user.clientId,
      id,
    );
  }

  @Get('amc/reports/:reportId')
  getWeeklyReportDetails(@Req() req: any, @Param('reportId') reportId: string) {
    return this.clientPortalService.getWeeklyReportDetails(
      req.user.clientId,
      reportId,
    );
  }

  @Get('amc/reports/:reportId/pdf')
  async downloadWeeklyReportPdf(
    @Req() req: any,
    @Param('reportId') reportId: string,
    @Res() res: Response,
  ) {
    // Verify client ownership first
    await this.clientPortalService.getWeeklyReportDetails(
      req.user.clientId,
      reportId,
    );
    const buffer = await this.pdfService.generateAmcReportPdf(reportId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="amc-report-${reportId}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.STORAGE_PATH || './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedExtensions = [
          '.jpg',
          '.jpeg',
          '.png',
          '.gif',
          '.pdf',
          '.doc',
          '.docx',
          '.xls',
          '.xlsx',
        ];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          return cb(
            new BadRequestException(
              `File extension ${ext} is not allowed for security reasons.`,
            ),
            false,
          );
        }
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(new BadRequestException('Invalid file MIME type'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize:
          parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10) * 1024 * 1024,
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Body('taskId') taskId?: string,
    @Body('ticketId') ticketId?: string,
    @Body('projectId') projectId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required or failed validation');
    }

    return this.uploadsService.saveAttachmentRecord(
      file,
      undefined, // uploadedById (staff)
      req.user.id, // uploadedByClientUserId (client user)
      taskId,
      ticketId,
      projectId,
      false, // isInternal
    );
  }

  @Get('assets')
  getAssets(@Req() req: any) {
    return this.clientPortalService.getAssets(req.user.clientId);
  }

  @Patch('assets/:assetId/monitoring')
  toggleAssetMonitoring(
    @Req() req: any,
    @Param('assetId') assetId: string,
    @Body('isMonitored') isMonitored: boolean,
  ) {
    return this.clientPortalService.toggleAssetMonitoring(
      req.user.clientId,
      assetId,
      !!isMonitored,
    );
  }

  @Get('profile')
  getProfile(@Req() req: any) {
    return this.clientPortalService.getProfile(req.user.id);
  }

  @Patch('profile')
  updateProfile(@Req() req: any, @Body() dto: any) {
    return this.clientPortalService.updateProfile(req.user.id, dto);
  }

  // ── Guardian Client Health & Incident Endpoints ────────────────────────────

  @Get('guardian/status')
  getClientSystemStatus(@Req() req: any) {
    return this.clientPortalService.getClientSystemStatus(req.user.clientId);
  }

  @Get('guardian/incidents')
  getClientIncidents(@Req() req: any) {
    return this.clientPortalService.getClientIncidents(req.user.clientId);
  }

  @Get('guardian/notification-preferences')
  getGuardianNotificationPreferences(@Req() req: any) {
    return this.clientPortalService.getClientNotificationPreferences(
      req.user.clientId,
    );
  }

  @Put('guardian/notification-preferences')
  updateGuardianNotificationPreferences(@Req() req: any, @Body() body: any) {
    return this.clientPortalService.updateClientNotificationPreferences(
      req.user.clientId,
      body,
    );
  }

  @Post('guardian/notification-preferences/test-telegram')
  @HttpCode(200)
  testGuardianTelegram(@Req() req: any) {
    return this.clientPortalService.testClientTelegram(req.user.clientId);
  }

  @Post('guardian/push/subscribe')
  @HttpCode(200)
  subscribeGuardianPush(@Req() req: any, @Body() body: any) {
    return this.clientPortalService.subscribeClientPush(
      req.user.clientId,
      body?.subscription ?? body,
      req.headers?.['user-agent'],
    );
  }

  @Post('guardian/push/unsubscribe')
  @HttpCode(200)
  unsubscribeGuardianPush(
    @Req() req: any,
    @Body() body: { endpoint?: string },
  ) {
    return this.clientPortalService.unsubscribeClientPush(
      req.user.clientId,
      body?.endpoint ?? '',
    );
  }

  @Post('guardian/push/test')
  @HttpCode(200)
  testGuardianPush(@Req() req: any) {
    return this.clientPortalService.testClientPush(req.user.clientId);
  }

  @Get('guardian/backups')
  getGuardianBackups(@Req() req: any) {
    return this.clientPortalService.getClientBackups(req.user.clientId);
  }

  @Post('guardian/backups/:assetId/restore-request')
  @HttpCode(200)
  requestGuardianRestore(
    @Req() req: any,
    @Param('assetId') assetId: string,
    @Body() body: any,
  ) {
    return this.clientPortalService.requestClientRestore(
      req.user.clientId,
      assetId,
      body,
    );
  }

  @Get('guardian/plan')
  getClientGuardianPlan(@Req() req: any) {
    return this.clientPortalService.getClientGuardianPlan(req.user.clientId);
  }

  @Get('guardian/expiries')
  getClientExpiries(@Req() req: any) {
    return this.clientPortalService.getClientExpiries(req.user.clientId);
  }

  @Get('guardian/findings')
  getClientFindings(@Req() req: any) {
    return this.clientPortalService.getClientFindings(req.user.clientId);
  }

  @Get('guardian/notifications')
  getClientNotifications(@Req() req: any) {
    return this.clientPortalService.getClientNotifications(req.user.clientId);
  }

  @Get('guardian/notification-preferences')
  getClientNotificationPreferences(@Req() req: any) {
    return this.clientPortalService.getClientNotificationPreferences(
      req.user.clientId,
    );
  }

  @Put('guardian/notification-preferences')
  updateClientNotificationPreferences(@Req() req: any, @Body() body: any) {
    return this.clientPortalService.updateClientNotificationPreferences(
      req.user.clientId,
      body,
    );
  }
}
