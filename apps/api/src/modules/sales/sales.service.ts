import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SalesRepository } from './sales.repository';
import { CreateQuoteDto, UpdateQuoteDto, ListQuotesQuery } from './dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../../common/pdf/pdf.service';

@Injectable()
export class SalesService {
  constructor(
    private readonly salesRepository: SalesRepository,
    private readonly prisma: PrismaService,
    private readonly companyProfileService: CompanyProfileService,
    private readonly notificationsService: NotificationsService,
    private readonly pdfService: PdfService,
  ) {}

  // ── Calculations ──────────────────────────────────────────────────────────

  private calcLineItems(items: any[], globalGstRate: number) {
    return items.map((item, idx) => {
      const qty = Number(item.quantity ?? 1);
      const unitPrice = Number(item.unitPrice ?? 0);
      const discountAmount = Number(item.discountAmount ?? 0);
      const gstRate = Number(item.gstRate ?? globalGstRate);
      const isFree = item.itemType === 'FREE';

      const amount = isFree ? 0 : Math.max(0, qty * unitPrice - discountAmount);
      const gstAmount = isFree
        ? 0
        : Math.round(amount * (gstRate / 100) * 100) / 100;

      return {
        serviceId: item.serviceId ?? null,
        itemType: item.itemType ?? 'SERVICE',
        description: item.description,
        longDescription: item.longDescription ?? null,
        quantity: qty,
        unit: item.unit ?? 'Project',
        unitPrice: isFree ? 0 : unitPrice,
        discountAmount,
        amount,
        gstRate,
        gstAmount,
        sortOrder: item.sortOrder ?? idx,
      };
    });
  }

  private calcQuoteTotals(lineItems: any[], globalDiscount = 0, gstRate = 18) {
    const subTotal = lineItems.reduce((s, li) => s + li.amount, 0);
    const gstAmount = lineItems.reduce((s, li) => s + li.gstAmount, 0);
    const discountAmount = Math.min(globalDiscount, subTotal);
    const grandTotal = Math.max(0, subTotal + gstAmount - discountAmount);
    return { subTotal, gstAmount, discountAmount, grandTotal };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async getQuote(id: string, user?: any) {
    const quote = await this.salesRepository.findById(id);
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    if (
      user?.userType === 'CUSTOMER' &&
      quote.organizationId &&
      quote.organizationId !== user.activeOrganizationId
    ) {
      throw new ForbiddenException('Access denied');
    }
    return this.enrichQuoteData(quote);
  }

  async listQuotes(query: ListQuotesQuery, user?: any) {
    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const result = await this.salesRepository.findAll(query, orgId);
    return {
      ...result,
      quotes: result.quotes.map((q) => this.enrichListItem(q)),
    };
  }

  async createQuote(dto: CreateQuoteDto, user?: any) {
    // Validate client
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client)
      throw new BadRequestException(`Client ${dto.clientId} not found`);

    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;

    const company = await this.companyProfileService.get();
    const quoteNumber = await this.salesRepository.generateQuoteNumber(
      company.quotePrefix ?? 'QUO',
    );

    const gstRate = Number(dto.gstRate ?? company.defaultGstRate ?? 18);
    const lineItems = this.calcLineItems(dto.items ?? [], gstRate);
    const totals = this.calcQuoteTotals(
      lineItems,
      Number(dto.discountAmount ?? 0),
      gstRate,
    );

    const quote = await this.salesRepository.create({
      quoteNumber,
      clientId: dto.clientId,
      organizationId: orgId,
      title: dto.title,
      description: dto.description,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      quoteType: dto.quoteType || 'PROJECT',
      gstRate,
      discountAmount: totals.discountAmount,
      discountPercent: Number(dto.discountPercent ?? 0),
      subTotal: totals.subTotal,
      gstAmount: totals.gstAmount,
      grandTotal: totals.grandTotal,
      milestoneSchedule: dto.milestoneSchedule ?? null,
      scopeOfWork: dto.scopeOfWork ?? null,
      exclusions: dto.exclusions ?? null,
      thirdPartyExpenses: dto.thirdPartyExpenses ?? null,
      termsConditions: dto.termsConditions ?? company.quoteTerms ?? null,
      lineItems: { create: lineItems },
    });

    return this.enrichQuoteData(quote);
  }

  async updateQuote(id: string, dto: UpdateQuoteDto, user?: any) {
    const quote = await this.salesRepository.findById(id);
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);

    const isEditAccepted = quote.status !== 'DRAFT';
    if (isEditAccepted) {
      const userRole = user?.role || '';
      if (userRole.toUpperCase() !== 'SUPER_ADMIN') {
        throw new ForbiddenException(
          'Only Super Admins are allowed to edit accepted or invoiced quotations',
        );
      }
    }

    const gstRate = Number(dto.gstRate ?? quote.gstRate ?? 18);
    const updateData: any = {
      title: dto.title ?? undefined,
      description: dto.description ?? undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      gstRate,
      discountPercent: dto.discountPercent ?? undefined,
      milestoneSchedule: dto.milestoneSchedule ?? undefined,
      scopeOfWork: dto.scopeOfWork ?? undefined,
      exclusions: dto.exclusions ?? undefined,
      thirdPartyExpenses: dto.thirdPartyExpenses ?? undefined,
      termsConditions: dto.termsConditions ?? undefined,
      quoteType: dto.quoteType ?? undefined,
    };

    if (isEditAccepted) {
      updateData.status = 'SENT'; // set status back to SENT so client can re-accept
      updateData.clientApproval = null;
      updateData.acceptedAt = null;
    }

    // If items provided, replace all line items
    if (dto.items) {
      await this.salesRepository.deleteLineItems(id);
      const lineItems = this.calcLineItems(dto.items, gstRate);
      const totals = this.calcQuoteTotals(
        lineItems,
        Number(dto.discountAmount ?? quote.discountAmount ?? 0),
        gstRate,
      );
      updateData.subTotal = totals.subTotal;
      updateData.gstAmount = totals.gstAmount;
      updateData.discountAmount = totals.discountAmount;
      updateData.grandTotal = totals.grandTotal;
      updateData.lineItems = { create: lineItems };
    } else if (dto.discountAmount !== undefined) {
      const existing = quote.lineItems ?? [];
      const totals = this.calcQuoteTotals(
        existing,
        Number(dto.discountAmount),
        gstRate,
      );
      updateData.discountAmount = totals.discountAmount;
      updateData.grandTotal = totals.grandTotal;
    }

    const updated = await this.salesRepository.update(id, updateData);
    return this.enrichQuoteData(updated);
  }

  async sendQuote(id: string) {
    const quote = await this.salesRepository.findById(id);
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    if (quote.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT quotes can be sent');
    const sentQuote = await this.salesRepository.updateStatus(id, 'SENT');
    try {
      const pdfBuffer = await this.pdfService.generateQuotationPdf(id);
      await this.notificationsService.handleQuoteSent(id, pdfBuffer);
    } catch (err: any) {
      console.error(`Failed to send quote email: ${err.message}`);
    }
    return this.enrichQuoteData(sentQuote);
  }

  async acceptQuote(id: string) {
    const quote = await this.salesRepository.findById(id);
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    if (quote.status !== 'SENT')
      throw new BadRequestException('Only SENT quotes can be accepted');
    if (quote.validUntil && new Date() > quote.validUntil)
      throw new BadRequestException('Cannot accept an expired quote');
    return this.enrichQuoteData(
      await this.salesRepository.updateStatus(id, 'ACCEPTED'),
    );
  }

  async rejectQuote(id: string) {
    const quote = await this.salesRepository.findById(id);
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    if (quote.status !== 'SENT')
      throw new BadRequestException('Only SENT quotes can be rejected');
    return this.enrichQuoteData(
      await this.salesRepository.updateStatus(id, 'REJECTED'),
    );
  }

  async deleteQuote(id: string) {
    const quote = await this.salesRepository.findById(id);
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    if (quote.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT quotes can be deleted');
    await this.salesRepository.softDelete(id);
    return { id, deleted: true };
  }

  async updateExpiredQuotes() {
    const expired = await this.salesRepository.findExpiredQuotes();
    for (const q of expired)
      await this.salesRepository.updateStatus(q.id, 'EXPIRED');
    return { updated: expired.length };
  }

  async rollbackQuote(id: string) {
    const quote = await this.salesRepository.findById(id);
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);
    const updated = await this.salesRepository.updateStatus(id, 'DRAFT');
    return this.enrichQuoteData(updated);
  }

  async resendQuote(id: string) {
    const quote = await this.salesRepository.findById(id);
    if (!quote) throw new NotFoundException(`Quote ${id} not found`);

    let currentQuote = quote;
    if (quote.status === 'DRAFT') {
      currentQuote = await this.salesRepository.updateStatus(id, 'SENT');
    }

    try {
      const pdfBuffer = await this.pdfService.generateQuotationPdf(id);
      await this.notificationsService.handleQuoteSent(id, pdfBuffer);
    } catch (err: any) {
      console.error(`Failed to resend quote email: ${err.message}`);
    }

    return this.enrichQuoteData(currentQuote);
  }

  private enrichQuoteData(quote: any) {
    const now = Date.now();
    const validUntilMs = quote.validUntil?.getTime?.();
    const isExpired = validUntilMs ? now > validUntilMs : false;
    const daysUntilExpiry = validUntilMs
      ? Math.ceil((validUntilMs - now) / 86400000)
      : null;
    return {
      ...quote,
      isExpired,
      daysUntilExpiry:
        daysUntilExpiry && daysUntilExpiry > 0 ? daysUntilExpiry : null,
    };
  }

  private enrichListItem(quote: any) {
    const enriched = this.enrichQuoteData(quote);
    return {
      id: enriched.id,
      quoteNumber: enriched.quoteNumber,
      title: enriched.title,
      clientId: enriched.clientId,
      clientName: enriched.client?.name,
      grandTotal: enriched.grandTotal,
      status: enriched.status,
      validUntil: enriched.validUntil,
      isExpired: enriched.isExpired,
      daysUntilExpiry: enriched.daysUntilExpiry,
      lineItemCount: enriched._count?.lineItems ?? 0,
      quoteType: enriched.quoteType,
      createdAt: enriched.createdAt,
    };
  }
}
