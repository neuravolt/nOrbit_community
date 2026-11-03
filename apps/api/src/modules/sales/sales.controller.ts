import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateQuoteDto, UpdateQuoteDto, ListQuotesQuery } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import { PdfService } from '../../common/pdf/pdf.service';
import type { Response } from 'express';

const MANAGEMENT_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CO_FOUNDER',
  'MANAGER',
  'ACCOUNTANT',
];
const ALL_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CO_FOUNDER',
  'MANAGER',
  'ACCOUNTANT',
  'DEVELOPER',
  'QA',
  'EMPLOYEE',
];

@Controller('quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  @Roles(ALL_ROLES)
  async listQuotes(@Query() query: ListQuotesQuery, @Req() req: any) {
    return this.salesService.listQuotes(query, req.user);
  }

  @Post()
  @Roles(MANAGEMENT_ROLES)
  @HttpCode(201)
  async createQuote(@Body() createQuoteDto: CreateQuoteDto, @Req() req: any) {
    return this.salesService.createQuote(createQuoteDto, req.user);
  }

  @Get(':id')
  @Roles(ALL_ROLES)
  async getQuote(@Param('id') id: string, @Req() req: any) {
    return this.salesService.getQuote(id, req.user);
  }

  @Get(':id/pdf')
  @Roles(ALL_ROLES)
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    try {
      const buffer = await this.pdfService.generateQuotationPdf(id);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quotation-${id}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (err: any) {
      res
        .status(500)
        .json({ message: err?.message ?? 'PDF generation failed' });
    }
  }

  @Patch(':id')
  @Roles(MANAGEMENT_ROLES)
  async updateQuote(
    @Param('id') id: string,
    @Body() updateQuoteDto: UpdateQuoteDto,
    @Req() req: any,
  ) {
    const user = req.user;
    return this.salesService.updateQuote(id, updateQuoteDto, user);
  }

  @Patch(':id/send')
  @Roles(MANAGEMENT_ROLES)
  async sendQuote(@Param('id') id: string) {
    return this.salesService.sendQuote(id);
  }

  @Patch(':id/accept')
  @Roles(MANAGEMENT_ROLES)
  async acceptQuote(@Param('id') id: string) {
    return this.salesService.acceptQuote(id);
  }

  @Patch(':id/reject')
  @Roles(MANAGEMENT_ROLES)
  async rejectQuote(@Param('id') id: string) {
    return this.salesService.rejectQuote(id);
  }

  @Patch(':id/rollback')
  @Roles(MANAGEMENT_ROLES)
  async rollbackQuote(@Param('id') id: string) {
    return this.salesService.rollbackQuote(id);
  }

  @Post(':id/resend')
  @Roles(MANAGEMENT_ROLES)
  async resendQuote(@Param('id') id: string) {
    return this.salesService.resendQuote(id);
  }

  @Delete(':id')
  @Roles(MANAGEMENT_ROLES)
  @HttpCode(204)
  async deleteQuote(@Param('id') id: string) {
    return this.salesService.deleteQuote(id);
  }
}
