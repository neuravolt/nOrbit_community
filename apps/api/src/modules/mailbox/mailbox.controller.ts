import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MailboxService } from './mailbox.service';
import { BillingService } from '../billing/billing.service';

@Controller('mailbox')
@UseGuards(JwtAuthGuard)
export class MailboxController {
  constructor(
    private readonly mailboxService: MailboxService,
    private readonly billingService: BillingService,
  ) {}

  @Get('inbox')
  async getInbox(
    @Query('folder') folder?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
  ) {
    return this.mailboxService.getInbox({ folder, limit, offset, search });
  }

  @Get('message/:id')
  async getMessage(@Param('id') id: string) {
    return this.mailboxService.getMessage(id);
  }

  @Get('sent')
  async getSentHistory(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.mailboxService.getSentHistory({
      limit,
      offset,
      search,
      entityType,
    });
  }

  @Get('invoices/:id/delivery')
  async getInvoiceDeliveryHistory(@Param('id') id: string) {
    return this.mailboxService.getInvoiceDeliveryHistory(id);
  }

  @Post('invoices/:id/resend')
  @HttpCode(HttpStatus.OK)
  async resendInvoice(@Param('id') id: string) {
    await this.billingService.resend(id);
    return this.mailboxService.getInvoiceDeliveryHistory(id);
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendEmail(
    @Body()
    dto: {
      to: string;
      subject: string;
      body: string;
      isHtml?: boolean;
      inReplyTo?: string;
      references?: string;
      entityType?: string;
      entityId?: string;
      clientId?: string;
    },
  ) {
    return this.mailboxService.sendEmail(dto);
  }
}
