import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  ListInvoicesQuery,
  RecordPaymentDto,
} from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../../common/pdf/pdf.service';

const INVOICE_INCLUDE = {
  client: {
    select: { id: true, name: true, email: true, phone: true, address: true },
  },
  quote: { select: { id: true, quoteNumber: true, title: true } },
  project: { select: { id: true, name: true } },
  lineItems: { orderBy: { sortOrder: 'asc' as const } },
  payments: { orderBy: { paidAt: 'desc' as const } },
  asset: true,
  amcContract: true,
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyProfileService: CompanyProfileService,
    private readonly notificationsService: NotificationsService,
    private readonly pdfService: PdfService,
  ) {}

  // ── Invoice Number Generation ────────────────────────────────────────────

  async generateInvoiceNumber(organizationId?: string | null): Promise<string> {
    const company = await this.companyProfileService.get(organizationId);
    const prefix = company.invoicePrefix ?? (organizationId ? 'INV' : 'NVLT');
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const latest = await this.prisma.invoice.findFirst({
      where: {
        invoiceNumber: { startsWith: `${prefix}-${year}-${month}` },
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { invoiceNumber: 'desc' },
    });

    let seq = 1;
    if (latest) {
      const parts = latest.invoiceNumber.split('-');
      const last = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(last)) seq = last + 1;
    }

    let candidate = `${prefix}-${year}-${month}-${String(seq).padStart(5, '0')}`;
    while (
      await this.prisma.invoice.findUnique({
        where: { invoiceNumber: candidate },
      })
    ) {
      seq++;
      candidate = `${prefix}-${year}-${month}-${String(seq).padStart(5, '0')}`;
    }
    return candidate;
  }

  // ── Auto-flag overdue ─────────────────────────────────────────────────────

  async autoFlagOverdue() {
    await this.prisma.invoice.updateMany({
      where: { status: 'sent', dueDate: { lt: new Date() } },
      data: { status: 'overdue', isOverdue: true },
    });
  }

  // ── CREATE (manual) ───────────────────────────────────────────────────────

  async create(dto: any, user?: any) {
    const orgId =
      user?.userType === 'CUSTOMER'
        ? user.activeOrganizationId
        : (dto.organizationId || null);
    const company = await this.companyProfileService.get(orgId);
    const invoiceNumber = await this.generateInvoiceNumber(orgId);
    const gstRate = Number(dto.gstRate ?? company.defaultGstRate ?? 18);
    const paymentTerms = Number(company.defaultPaymentTerms ?? 7);

    const {
      clientId,
      projectId,
      quoteId,
      assetId,
      amcContractId,
      items,
      discountAmount = 0,
      notes,
    } = dto;

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new BadRequestException(`Client ${clientId} not found`);

    // Fetch default HSN codes from ServiceCatalog if serviceId is provided
    const serviceIds = (items ?? [])
      .map((i: any) => i.serviceId)
      .filter(Boolean);
    const services =
      serviceIds.length > 0
        ? await this.prisma.serviceCatalog.findMany({
            where: { id: { in: serviceIds } },
          })
        : [];
    const serviceMap = new Map(services.map((s: any) => [s.id, s]));

    const isIntraState =
      !client.state ||
      !company.state ||
      client.state.trim().toLowerCase() === company.state.trim().toLowerCase();
    const gstType = isIntraState ? 'CGST_SGST' : 'IGST';

    // Calculate line items
    const lineItems = (items ?? []).map((item: any, idx: number) => {
      const qty = Number(item.quantity ?? 1);
      const unitPrice = Number(item.unitPrice ?? 0);
      const disc = Number(item.discountAmount ?? 0);
      const isFree = item.itemType === 'FREE';
      const amount = isFree ? 0 : Math.max(0, qty * unitPrice - disc);
      const itemGstRate = Number(item.gstRate ?? gstRate);
      const itemGstAmount = isFree
        ? 0
        : Math.round(amount * (itemGstRate / 100) * 100) / 100;

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      if (gstType === 'CGST_SGST') {
        cgstAmount =
          Math.round(((amount * (itemGstRate / 2)) / 100) * 100) / 100;
        sgstAmount =
          Math.round(((amount * (itemGstRate / 2)) / 100) * 100) / 100;
      } else {
        igstAmount = itemGstAmount;
      }

      const service = item.serviceId ? serviceMap.get(item.serviceId) : null;
      const hsnCode = item.hsnCode ?? service?.hsnCode ?? null;

      return {
        serviceId: item.serviceId ?? null,
        description: item.description,
        longDescription: item.longDescription ?? null,
        quantity: qty,
        unit: item.unit ?? 'Project',
        unitPrice: isFree ? 0 : unitPrice,
        discountAmount: disc,
        amount,
        gstRate: itemGstRate,
        gstAmount: itemGstAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        hsnCode,
        sortOrder: idx,
      };
    });

    const subTotal = lineItems.reduce((s: number, li: any) => s + li.amount, 0);
    const totalCgstAmount = lineItems.reduce(
      (s: number, li: any) => s + li.cgstAmount,
      0,
    );
    const totalSgstAmount = lineItems.reduce(
      (s: number, li: any) => s + li.sgstAmount,
      0,
    );
    const totalIgstAmount = lineItems.reduce(
      (s: number, li: any) => s + li.igstAmount,
      0,
    );
    const gstAmount = lineItems.reduce(
      (s: number, li: any) => s + li.gstAmount,
      0,
    );
    const disc = Math.min(Number(discountAmount), subTotal);
    const grandTotal = Math.max(0, subTotal + gstAmount - disc);
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + paymentTerms * 86400000);

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId,
        organizationId: orgId,
        projectId: projectId ?? null,
        quoteId: quoteId ?? null,
        assetId: assetId ?? null,
        amcContractId: amcContractId ?? null,
        status: 'draft',
        gstType,
        gstRate,
        cgstRate: gstType === 'CGST_SGST' ? gstRate / 2 : 0,
        cgstAmount: totalCgstAmount,
        sgstRate: gstType === 'CGST_SGST' ? gstRate / 2 : 0,
        sgstAmount: totalSgstAmount,
        igstRate: gstType === 'IGST' ? gstRate : 0,
        igstAmount: totalIgstAmount,
        gstAmount,
        subTotal,
        discountAmount: disc,
        grandTotal,
        amountPaid: 0,
        balanceDue: grandTotal,
        notes: notes ?? null,
        issueDate,
        dueDate,
        lineItems: { create: lineItems },
      },
      include: INVOICE_INCLUDE,
    });
  }

  // ── CREATE from accepted Quote ────────────────────────────────────────────

  async createFromQuote(quoteId: string) {
    // ── Idempotency guard: return existing invoice if already converted ──────
    const existing = await this.prisma.invoice.findFirst({
      where: { quoteId },
      include: INVOICE_INCLUDE,
    });
    if (existing) {
      if (
        ['sent', 'paid', 'partial_paid', 'overdue'].includes(
          existing.status.toLowerCase(),
        )
      ) {
        throw new BadRequestException(
          'An invoice has already been generated for this quotation.',
        );
      }
      return existing; // Return draft or cancelled invoice to open it
    }

    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { lineItems: true, client: true },
    });
    if (!quote) throw new NotFoundException(`Quote ${quoteId} not found`);
    if (quote.status !== 'ACCEPTED')
      throw new BadRequestException(
        'Only ACCEPTED quotes can be converted to invoices',
      );

    const quoteType = (quote.quoteType || 'PROJECT').toUpperCase();

    if (quoteType === 'AMC') {
      let contract = await this.prisma.amcContract.findUnique({
        where: { quoteId },
      });
      if (!contract) {
        // Create contract
        const cleanName = quote.client.name
          .replace(/[^a-zA-Z]/g, '')
          .toUpperCase();
        const clientPart = (cleanName.slice(0, 2) || 'XX').padEnd(2, 'X');
        const now = new Date();
        const datePart = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
        let attempts = 0;
        let contractNumber = '';
        while (attempts < 10) {
          const randomPart = String(Math.floor(Math.random() * 90) + 10);
          contractNumber = `AMC${clientPart}-${datePart}-${randomPart}`;
          const conflict = await this.prisma.amcContract.findUnique({
            where: { contractNumber },
          });
          if (!conflict) break;
          attempts++;
        }

        contract = await this.prisma.amcContract.create({
          data: {
            contractNumber,
            startDate: new Date(),
            endDate: new Date(
              new Date().setFullYear(new Date().getFullYear() + 1),
            ),
            totalHours: 120,
            remainingHours: 120,
            hourlyRate:
              Math.round((Number(quote.grandTotal) / 120) * 100) / 100,
            monthlyValue: Number(quote.grandTotal) / 12,
            billingCycle: 'MONTHLY',
            status: 'ACTIVE',
            clientId: quote.clientId,
            quoteId: quote.id,
          },
        });
      }

      // Now, generate first month's invoice if not already generated
      const existingAmcInvoice = await this.prisma.invoice.findFirst({
        where: { amcContractId: contract.id },
        include: INVOICE_INCLUDE,
      });
      if (existingAmcInvoice) {
        if (
          ['sent', 'paid', 'partial_paid', 'overdue'].includes(
            existingAmcInvoice.status.toLowerCase(),
          )
        ) {
          throw new BadRequestException(
            'An invoice has already been generated for this quotation.',
          );
        }
        if (!existingAmcInvoice.quoteId) {
          return this.prisma.invoice.update({
            where: { id: existingAmcInvoice.id },
            data: { quoteId: quote.id },
            include: INVOICE_INCLUDE,
          });
        }
        return existingAmcInvoice;
      }

      const invoice = await this.createAmcInvoice(contract.id);
      return this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { quoteId: quote.id },
        include: INVOICE_INCLUDE,
      });
    }

    if (quoteType === 'ASSET') {
      let asset = await this.prisma.asset.findUnique({
        where: { quoteId },
      });
      if (!asset) {
        // Create Asset
        let assetType = 'WEBSITE';
        const keywords = ['DOMAIN', 'HOSTING', 'VPS', 'SSL'];
        for (const kw of keywords) {
          if (quote.title.toUpperCase().includes(kw)) {
            assetType = kw === 'SSL' ? 'SSL_CERTIFICATE' : kw;
            break;
          }
        }

        asset = await this.prisma.asset.create({
          data: {
            name: quote.title,
            type: assetType as any,
            description: quote.description ?? 'Asset created from Quote',
            clientId: quote.clientId,
            renewalDate: new Date(
              new Date().setFullYear(new Date().getFullYear() + 1),
            ),
            cost: Number(quote.grandTotal),
            billingCycle: 'ANNUALLY',
            notes: `Converted from Quote #${quote.quoteNumber ?? quote.id}`,
            quoteId: quote.id,
          },
        });
      }

      const existingAssetInvoice = await this.prisma.invoice.findFirst({
        where: { assetId: asset.id },
        include: INVOICE_INCLUDE,
      });
      if (existingAssetInvoice) {
        if (!existingAssetInvoice.quoteId) {
          return this.prisma.invoice.update({
            where: { id: existingAssetInvoice.id },
            data: { quoteId: quote.id },
            include: INVOICE_INCLUDE,
          });
        }
        return existingAssetInvoice;
      }

      // Generate invoice for asset
      const company = await this.companyProfileService.get();
      const invoiceNumber = await this.generateInvoiceNumber();
      const paymentTerms = Number(company.defaultPaymentTerms ?? 7);
      const issueDate = new Date();
      const dueDate = new Date(issueDate.getTime() + paymentTerms * 86400000);

      const isIntraState =
        !quote.client.state ||
        !company.state ||
        quote.client.state.trim().toLowerCase() ===
          company.state.trim().toLowerCase();
      const gstType = isIntraState ? 'CGST_SGST' : 'IGST';

      const lineItems = quote.lineItems.map((li: any, idx: number) => {
        const amount = li.amount;
        const itemGstRate = li.gstRate;
        const itemGstAmount = li.gstAmount;

        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;

        if (gstType === 'CGST_SGST') {
          cgstAmount =
            Math.round(((amount * (itemGstRate / 2)) / 100) * 100) / 100;
          sgstAmount =
            Math.round(((amount * (itemGstRate / 2)) / 100) * 100) / 100;
        } else {
          igstAmount = itemGstAmount;
        }

        return {
          serviceId: li.serviceId ?? null,
          description: li.description,
          longDescription: li.longDescription,
          quantity: li.quantity,
          unit: li.unit,
          unitPrice: li.unitPrice,
          discountAmount: li.discountAmount,
          amount,
          gstRate: itemGstRate,
          gstAmount: itemGstAmount,
          cgstAmount,
          sgstAmount,
          igstAmount,
          hsnCode: li.hsnCode ?? null,
          sortOrder: idx,
        };
      });

      const totalCgstAmount = lineItems.reduce(
        (s: number, li: any) => s + li.cgstAmount,
        0,
      );
      const totalSgstAmount = lineItems.reduce(
        (s: number, li: any) => s + li.sgstAmount,
        0,
      );
      const totalIgstAmount = lineItems.reduce(
        (s: number, li: any) => s + li.igstAmount,
        0,
      );

      const invoice = await this.prisma.invoice.create({
        data: {
          invoiceNumber,
          clientId: quote.clientId,
          quoteId: quote.id,
          assetId: asset.id,
          status: 'draft',
          gstType,
          gstRate: quote.gstRate ?? 18,
          cgstRate:
            gstType === 'CGST_SGST'
              ? quote.gstRate
                ? Number(quote.gstRate) / 2
                : 0
              : 0,
          cgstAmount: totalCgstAmount,
          sgstRate:
            gstType === 'CGST_SGST'
              ? quote.gstRate
                ? Number(quote.gstRate) / 2
                : 0
              : 0,
          sgstAmount: totalSgstAmount,
          igstRate: gstType === 'IGST' ? (quote.gstRate ?? 18) : 0,
          igstAmount: totalIgstAmount,
          gstAmount: quote.gstAmount ?? 0,
          subTotal: quote.subTotal ?? 0,
          discountAmount: quote.discountAmount ?? 0,
          grandTotal: quote.grandTotal ?? 0,
          amountPaid: 0,
          balanceDue: quote.grandTotal ?? 0,
          issueDate,
          dueDate,
          lineItems: { create: lineItems },
        },
        include: INVOICE_INCLUDE,
      });

      return invoice;
    }

    const company = await this.companyProfileService.get();
    const invoiceNumber = await this.generateInvoiceNumber();
    const paymentTerms = Number(company.defaultPaymentTerms ?? 7);
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + paymentTerms * 86400000);

    const isIntraState =
      !quote.client.state ||
      !company.state ||
      quote.client.state.trim().toLowerCase() ===
        company.state.trim().toLowerCase();
    const gstType = isIntraState ? 'CGST_SGST' : 'IGST';

    const lineItems = quote.lineItems.map((li: any, idx: number) => {
      const amount = li.amount;
      const itemGstRate = li.gstRate;
      const itemGstAmount = li.gstAmount;

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (gstType === 'CGST_SGST') {
        cgstAmount =
          Math.round(((amount * (itemGstRate / 2)) / 100) * 100) / 100;
        sgstAmount =
          Math.round(((amount * (itemGstRate / 2)) / 100) * 100) / 100;
      } else {
        igstAmount = itemGstAmount;
      }

      return {
        serviceId: li.serviceId ?? null,
        description: li.description,
        longDescription: li.longDescription,
        quantity: li.quantity,
        unit: li.unit,
        unitPrice: li.unitPrice,
        discountAmount: li.discountAmount,
        amount,
        gstRate: itemGstRate,
        gstAmount: itemGstAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        hsnCode: li.hsnCode ?? null,
        sortOrder: idx,
      };
    });

    const totalCgstAmount = lineItems.reduce(
      (s: number, li: any) => s + li.cgstAmount,
      0,
    );
    const totalSgstAmount = lineItems.reduce(
      (s: number, li: any) => s + li.sgstAmount,
      0,
    );
    const totalIgstAmount = lineItems.reduce(
      (s: number, li: any) => s + li.igstAmount,
      0,
    );

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: quote.clientId,
        quoteId,
        status: 'draft',
        gstType,
        gstRate: quote.gstRate ?? 18,
        cgstRate:
          gstType === 'CGST_SGST'
            ? quote.gstRate
              ? Number(quote.gstRate) / 2
              : 0
            : 0,
        cgstAmount: totalCgstAmount,
        sgstRate:
          gstType === 'CGST_SGST'
            ? quote.gstRate
              ? Number(quote.gstRate) / 2
              : 0
            : 0,
        sgstAmount: totalSgstAmount,
        igstRate: gstType === 'IGST' ? (quote.gstRate ?? 18) : 0,
        igstAmount: totalIgstAmount,
        gstAmount: quote.gstAmount ?? 0,
        subTotal: quote.subTotal ?? 0,
        discountAmount: quote.discountAmount ?? 0,
        grandTotal: quote.grandTotal ?? 0,
        amountPaid: 0,
        balanceDue: quote.grandTotal ?? 0,
        issueDate,
        dueDate,
        lineItems: { create: lineItems },
      },
      include: INVOICE_INCLUDE,
    });
  }

  // ── CREATE from Time Logs (T&M billing) ──────────────────────────────────

  async createFromTimeLogs(projectId: string, clientId: string) {
    const unbilled = await this.prisma.timeLog.findMany({
      where: { isBilled: false, isBillable: true, task: { projectId } },
      include: {
        task: { select: { title: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (unbilled.length === 0)
      throw new BadRequestException(
        'No unbilled time logs found for this project',
      );

    const company = await this.companyProfileService.get();
    const invoiceNumber = await this.generateInvoiceNumber();
    const gstRate = Number(company.defaultGstRate ?? 18);
    const paymentTerms = Number(company.defaultPaymentTerms ?? 7);
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + paymentTerms * 86400000);

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new BadRequestException(`Client ${clientId} not found`);

    const isIntraState =
      !client.state ||
      !company.state ||
      client.state.trim().toLowerCase() === company.state.trim().toLowerCase();
    const gstType = isIntraState ? 'CGST_SGST' : 'IGST';

    const lineItems = unbilled.map((log: any, idx: number) => {
      const logHourlyRate = Number(log.hourlyRate ?? 0);
      const amount = Math.round(log.hours * logHourlyRate * 100) / 100;
      const itemGstRate = gstRate;
      const itemGstAmount =
        Math.round(amount * (itemGstRate / 100) * 100) / 100;

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (gstType === 'CGST_SGST') {
        cgstAmount =
          Math.round(((amount * (itemGstRate / 2)) / 100) * 100) / 100;
        sgstAmount =
          Math.round(((amount * (itemGstRate / 2)) / 100) * 100) / 100;
      } else {
        igstAmount = itemGstAmount;
      }

      return {
        description: `${log.task.title} — ${log.user.firstName} ${log.user.lastName}`,
        quantity: log.hours,
        unit: 'Hour',
        unitPrice: logHourlyRate,
        discountAmount: 0,
        amount,
        gstRate: itemGstRate,
        gstAmount: itemGstAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        hsnCode: '998311', // default Software Development services HSN
        sortOrder: idx,
      };
    });

    const subTotal = lineItems.reduce((s: number, li: any) => s + li.amount, 0);
    const totalCgstAmount = lineItems.reduce(
      (s: number, li: any) => s + li.cgstAmount,
      0,
    );
    const totalSgstAmount = lineItems.reduce(
      (s: number, li: any) => s + li.sgstAmount,
      0,
    );
    const totalIgstAmount = lineItems.reduce(
      (s: number, li: any) => s + li.igstAmount,
      0,
    );
    const gstAmount = lineItems.reduce(
      (s: number, li: any) => s + li.gstAmount,
      0,
    );
    const grandTotal = subTotal + gstAmount;

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId,
        projectId,
        status: 'draft',
        gstType,
        gstRate,
        cgstRate: gstType === 'CGST_SGST' ? gstRate / 2 : 0,
        cgstAmount: totalCgstAmount,
        sgstRate: gstType === 'CGST_SGST' ? gstRate / 2 : 0,
        sgstAmount: totalSgstAmount,
        igstRate: gstType === 'IGST' ? gstRate : 0,
        igstAmount: totalIgstAmount,
        gstAmount,
        subTotal,
        discountAmount: 0,
        grandTotal,
        amountPaid: 0,
        balanceDue: grandTotal,
        issueDate,
        dueDate,
        lineItems: { create: lineItems },
        timeLogs: { connect: unbilled.map((l: any) => ({ id: l.id })) },
      },
      include: INVOICE_INCLUDE,
    });

    // Mark time logs as billed
    await this.prisma.timeLog.updateMany({
      where: { id: { in: unbilled.map((l: any) => l.id) } },
      data: { isBilled: true, invoiceId: invoice.id },
    });

    return invoice;
  }

  // ── LIST ─────────────────────────────────────────────────────────────────

  async findAll(query: ListInvoicesQuery, user?: any) {
    await this.autoFlagOverdue();
    const {
      page = 1,
      limit = 20,
      status,
      clientId,
      amcContractId,
      startDate,
      endDate,
      overdue,
      sort = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { deletedAt: null };

    if (user?.userType === 'CUSTOMER') {
      where.organizationId = user.activeOrganizationId;
    }

    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (amcContractId) where.amcContractId = amcContractId;
    if (overdue === true || overdue === 'true') where.status = 'overdue';
    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) where.issueDate.gte = new Date(startDate);
      if (endDate) where.issueDate.lte = new Date(endDate);
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sort]: sortOrder },
        include: {
          client: { select: { id: true, name: true, email: true } },
          _count: { select: { lineItems: true, payments: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      invoices,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  // ── GET ONE ───────────────────────────────────────────────────────────────

  async findOne(id: string, user?: any) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);

    if (user?.userType === 'CUSTOMER') {
      if (
        !invoice.organizationId ||
        invoice.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this invoice');
      }
    }

    return invoice;
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateInvoiceDto, user?: any) {
    const invoice = await this.findOne(id, user);
    if (invoice.status !== 'draft')
      throw new BadRequestException('Only draft invoices can be updated');
    return this.prisma.invoice.update({
      where: { id },
      data: dto as any,
      include: INVOICE_INCLUDE,
    });
  }

  async send(id: string, user?: any) {
    const invoice = await this.findOne(id, user);
    if (invoice.status !== 'draft')
      throw new BadRequestException('Only draft invoices can be sent');
    const sentInvoice = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'sent' },
      include: INVOICE_INCLUDE,
    });
    try {
      const pdfBuffer = await this.pdfService.generateInvoicePdf(id);
      await this.notificationsService.handleInvoiceSent(id, pdfBuffer);
    } catch (err: any) {
      console.error(`Failed to send invoice email: ${err.message}`);
    }
    return sentInvoice;
  }

  // ── RECORD PAYMENT ────────────────────────────────────────────────────────

  async recordPayment(id: string, dto: RecordPaymentDto, user?: any) {
    const invoice = await this.findOne(id, user);
    if (invoice.status === 'cancelled')
      throw new BadRequestException(
        'Cannot record payment for cancelled invoice',
      );

    await this.prisma.payment.create({
      data: {
        invoiceId: id,
        amount: Number(dto.amount),
        method: dto.method,
        transactionId: dto.transactionId ?? null,
        notes: dto.notes ?? null,
        receiptUrl: dto.receiptUrl ?? null,
      },
    });

    const newAmountPaid = Number(invoice.amountPaid) + Number(dto.amount);
    const newBalanceDue = Math.max(
      0,
      Number(invoice.grandTotal) - newAmountPaid,
    );
    const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial_paid';
    const isOverdue = newStatus === 'paid' ? false : invoice.isOverdue;

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        status: newStatus,
        isOverdue,
      },
      include: INVOICE_INCLUDE,
    });

    if (newStatus === 'paid' && invoice.status !== 'paid' && invoice.assetId) {
      try {
        const asset = await this.prisma.asset.findUnique({
          where: { id: invoice.assetId },
        });
        if (asset) {
          const currentRenewal = asset.renewalDate
            ? new Date(asset.renewalDate)
            : new Date();
          const nextRenewal = new Date(currentRenewal);
          const cycle = (asset.billingCycle || 'ANNUALLY').toUpperCase();
          if (cycle === 'MONTHLY') {
            nextRenewal.setMonth(nextRenewal.getMonth() + 1);
          } else if (cycle === 'QUARTERLY') {
            nextRenewal.setMonth(nextRenewal.getMonth() + 3);
          } else {
            // Default is ANNUALLY
            nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
          }
          await this.prisma.asset.update({
            where: { id: asset.id },
            data: { renewalDate: nextRenewal },
          });
        }
      } catch (err: any) {
        console.error(
          `Failed to auto-update asset renewal date: ${err.message}`,
        );
      }
    }

    if (
      newStatus === 'paid' &&
      invoice.invoiceNumber?.startsWith('INV-SUB-') &&
      invoice.organizationId
    ) {
      try {
        const planMatch = invoice.notes?.match(
          /Subscription upgrade to ([\w\s]+) \((MONTHLY|ANNUAL|YEARLY)\)/i,
        );
        const planName = planMatch ? planMatch[1].trim() : null;
        const rawInterval = planMatch ? planMatch[2].toUpperCase() : 'MONTHLY';
        const interval =
          rawInterval === 'YEARLY' || rawInterval === 'ANNUAL'
            ? 'ANNUAL'
            : 'MONTHLY';

        let targetPlan: any = null;
        if (planName) {
          targetPlan = await this.prisma.plan.findFirst({
            where: { name: { equals: planName, mode: 'insensitive' } },
          });
        }
        if (!targetPlan && invoice.lineItems?.length) {
          for (const item of invoice.lineItems) {
            const desc = item.description || '';
            const m = desc.match(/(Starter|Pro|Enterprise)/i);
            if (m) {
              targetPlan = await this.prisma.plan.findFirst({
                where: { name: { equals: m[1], mode: 'insensitive' } },
              });
              if (targetPlan) break;
            }
          }
        }

        if (targetPlan) {
          await this.prisma.organizationSubscription.upsert({
            where: { organizationId: invoice.organizationId },
            create: {
              organizationId: invoice.organizationId,
              planId: targetPlan.id,
              status: 'ACTIVE',
              billingInterval: interval,
              currency: (invoice as any).currency || 'INR',
            },
            update: {
              planId: targetPlan.id,
              status: 'ACTIVE',
              billingInterval: interval,
              currency: (invoice as any).currency || 'INR',
            },
          });
        }
      } catch (subErr: any) {
        console.error(
          `Failed to auto-activate organization subscription: ${subErr.message}`,
        );
      }
    }

    try {
      const pdfBuffer = await this.pdfService.generateInvoicePdf(id);
      await this.notificationsService.handleInvoiceSent(id, pdfBuffer);
    } catch (err: any) {
      console.error(
        `Failed to send payment notification email: ${err.message}`,
      );
    }

    return updatedInvoice;
  }

  // ── DELETE ────────────────────────────────────────────────────────────────

  async delete(id: string, user?: any) {
    const invoice = await this.findOne(id, user);
    if (!['draft', 'cancelled'].includes(invoice.status))
      throw new BadRequestException(
        'Only draft or cancelled invoices can be deleted',
      );
    await this.prisma.invoice.delete({ where: { id } });
    return { id, deleted: true };
  }

  async rollback(id: string, user?: any) {
    const invoice = await this.findOne(id, user);
    if (
      invoice.status?.toLowerCase() === 'paid' ||
      invoice.status?.toLowerCase() === 'partial_paid' ||
      Number(invoice.amountPaid || 0) > 0 ||
      (invoice.payments && invoice.payments.length > 0)
    ) {
      throw new BadRequestException(
        'A paid or partially paid invoice cannot be reverted to draft.',
      );
    }
    if (invoice.status?.toLowerCase() === 'cancelled') {
      throw new BadRequestException(
        'A cancelled invoice cannot be reverted to draft.',
      );
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'draft' },
      include: INVOICE_INCLUDE,
    });
    return updated;
  }

  async resend(id: string, user?: any) {
    const invoice = await this.findOne(id, user);
    let currentInvoice = invoice;
    if (invoice.status === 'draft') {
      currentInvoice = await this.prisma.invoice.update({
        where: { id },
        data: { status: 'sent' },
        include: INVOICE_INCLUDE,
      });
    }
    try {
      const pdfBuffer = await this.pdfService.generateInvoicePdf(id);
      await this.notificationsService.handleInvoiceSent(id, pdfBuffer);
    } catch (err: any) {
      console.error(`Failed to resend invoice email: ${err.message}`);
    }
    return currentInvoice;
  }

  async getOverdue(user?: any) {
    await this.autoFlagOverdue();
    const where: any = { status: 'overdue' };
    if (user?.userType === 'CUSTOMER') {
      where.organizationId = user.activeOrganizationId;
    }
    return this.prisma.invoice.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async createAmcInvoice(contractId: string) {
    // Prevent duplicate active invoices for the same AMC Contract
    const existingActiveInvoice = await this.prisma.invoice.findFirst({
      where: {
        amcContractId: contractId,
        status: { in: ['draft', 'sent', 'partial_paid', 'overdue'] },
      },
    });
    if (existingActiveInvoice) {
      throw new BadRequestException(
        `An unpaid invoice (Invoice #${existingActiveInvoice.invoiceNumber}) already exists for this contract. Please pay or cancel it first.`,
      );
    }

    // Prevent duplicate generations within 10 seconds to handle race conditions/double clicks
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const recentInvoice = await this.prisma.invoice.findFirst({
      where: {
        amcContractId: contractId,
        createdAt: {
          gte: tenSecondsAgo,
        },
      },
    });
    if (recentInvoice) {
      throw new BadRequestException(
        'An invoice for this contract was already generated recently. Please wait a moment.',
      );
    }

    const contract = await this.prisma.amcContract.findUnique({
      where: { id: contractId },
      include: { client: true },
    });
    if (!contract)
      throw new NotFoundException(`AMC Contract ${contractId} not found`);

    const company = await this.companyProfileService.get();
    const invoiceNumber = await this.generateInvoiceNumber();
    const gstRate = Number(company.defaultGstRate ?? 18);
    const paymentTerms = Number(company.defaultPaymentTerms ?? 7);
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + paymentTerms * 86400000);

    const client = contract.client;
    const isIntraState =
      !client.state ||
      !company.state ||
      client.state.trim().toLowerCase() === company.state.trim().toLowerCase();
    const gstType = isIntraState ? 'CGST_SGST' : 'IGST';

    const monthlyValue = Number(contract.monthlyValue ?? 0);
    let amount = monthlyValue;
    let cycleLabel = 'Month';
    const cycle = contract.billingCycle;

    if (cycle === 'QUARTERLY') {
      amount = monthlyValue * 3;
      cycleLabel = 'Quarter';
    } else if (cycle === 'HALF_YEARLY') {
      amount = monthlyValue * 6;
      cycleLabel = 'Half Year';
    } else if (cycle === 'ANNUAL') {
      amount = monthlyValue * 12;
      cycleLabel = 'Year';
    }

    const gstAmount = Math.round(amount * (gstRate / 100) * 100) / 100;

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    if (gstType === 'CGST_SGST') {
      cgstAmount = Math.round(((amount * (gstRate / 2)) / 100) * 100) / 100;
      sgstAmount = Math.round(((amount * (gstRate / 2)) / 100) * 100) / 100;
    } else {
      igstAmount = gstAmount;
    }

    const item = {
      description: `Annual Maintenance Services — Contract ${contract.contractNumber} (${cycle})`,
      quantity: 1,
      unit: cycleLabel,
      unitPrice: amount,
      discountAmount: 0,
      amount,
      gstRate,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      hsnCode: '998311',
      sortOrder: 0,
    };

    const discountAmount = Number(contract.discount ?? 0);
    const grandTotal = Math.max(0, amount + gstAmount - discountAmount);

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: contract.clientId,
        status: 'draft',
        gstType,
        gstRate,
        cgstRate: gstType === 'CGST_SGST' ? gstRate / 2 : 0,
        cgstAmount,
        sgstRate: gstType === 'CGST_SGST' ? gstRate / 2 : 0,
        sgstAmount,
        igstRate: gstType === 'IGST' ? gstRate : 0,
        igstAmount,
        gstAmount,
        subTotal: amount,
        discountAmount,
        grandTotal,
        amountPaid: 0,
        balanceDue: grandTotal,
        issueDate,
        dueDate,
        amcContractId: contract.id,
        quoteId: contract.quoteId ?? null,
        lineItems: { create: [item] },
      },
      include: INVOICE_INCLUDE,
    });

    const currentNextBilling = contract.nextBillingDate
      ? new Date(contract.nextBillingDate)
      : new Date();
    const nextBillingDate = new Date(currentNextBilling);
    if (cycle === 'MONTHLY') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else if (cycle === 'QUARTERLY') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
    } else if (cycle === 'HALF_YEARLY') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 6);
    } else if (cycle === 'ANNUAL') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }
    await this.prisma.amcContract.update({
      where: { id: contractId },
      data: { nextBillingDate },
    });

    return invoice;
  }

  async sendOverdueReminders(user?: any) {
    const where: any = {
      status: 'overdue',
      balanceDue: { gt: 0 },
    };
    if (user?.userType === 'CUSTOMER') {
      where.organizationId = user.activeOrganizationId;
    }
    const overdueInvoices = await this.prisma.invoice.findMany({
      where,
    });

    let sentCount = 0;
    for (const inv of overdueInvoices) {
      try {
        const overdueDays = inv.dueDate
          ? Math.max(
              0,
              Math.floor(
                (new Date().getTime() - new Date(inv.dueDate).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 0;

        let pdfBuffer: Buffer | undefined = undefined;
        try {
          pdfBuffer = await this.pdfService.generateInvoicePdf(inv.id);
        } catch (pdfErr) {
          console.error(
            `Failed to generate PDF for overdue invoice reminder ${inv.id}:`,
            pdfErr,
          );
        }

        await this.notificationsService.handleInvoiceOverdue(
          inv.id,
          overdueDays,
          pdfBuffer,
        );
        sentCount++;
      } catch (err: any) {
        console.error(
          `Failed to send overdue reminder for invoice ${inv.id}:`,
          err.message,
        );
      }
    }

    return { count: sentCount };
  }

  async createAssetRenewalInvoice(assetId: string) {
    // Prevent duplicate active invoices for the same Asset
    const existingActiveInvoice = await this.prisma.invoice.findFirst({
      where: {
        assetId,
        status: { in: ['draft', 'sent', 'partial_paid', 'overdue'] },
      },
    });
    if (existingActiveInvoice) {
      throw new BadRequestException(
        `An unpaid invoice (Invoice #${existingActiveInvoice.invoiceNumber}) already exists for this asset. Please pay or cancel it first.`,
      );
    }

    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      include: { client: true },
    });
    if (!asset) throw new NotFoundException(`Asset ${assetId} not found`);

    const company = await this.companyProfileService.get();
    const invoiceNumber = await this.generateInvoiceNumber();
    const paymentTerms = Number(company.defaultPaymentTerms ?? 7);
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + paymentTerms * 86400000);

    const isIntraState =
      !asset.client.state ||
      !company.state ||
      asset.client.state.trim().toLowerCase() ===
        company.state.trim().toLowerCase();
    const gstType = isIntraState ? 'CGST_SGST' : 'IGST';

    // Default rate for Asset renewal is its cost (or 0 if null)
    const rate = Number(asset.cost ?? 0);
    const gstRate = Number(company.defaultGstRate ?? 18);
    const amount = rate;
    const gstAmount = Math.round(((amount * gstRate) / 100) * 100) / 100;

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (gstType === 'CGST_SGST') {
      cgstAmount = gstAmount / 2;
      sgstAmount = gstAmount / 2;
    } else {
      igstAmount = gstAmount;
    }

    const subTotal = amount;
    const grandTotal = subTotal + gstAmount;

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: asset.clientId,
        assetId: asset.id,
        issueDate,
        dueDate,
        subTotal,
        gstType,
        gstRate,
        cgstRate: gstType === 'CGST_SGST' ? gstRate / 2 : 0,
        cgstAmount,
        sgstRate: gstType === 'CGST_SGST' ? gstRate / 2 : 0,
        sgstAmount,
        igstRate: gstType === 'IGST' ? gstRate : 0,
        igstAmount,
        gstAmount,
        grandTotal,
        balanceDue: grandTotal,
        status: 'draft',
        notes: `Automated renewal invoice for Asset: ${asset.name}. Billing cycle: ${asset.billingCycle || 'ANNUALLY'}.`,
        lineItems: {
          create: [
            {
              description: `${asset.name} Renewal Service`,
              quantity: 1,
              unitPrice: rate,
              gstRate,
              gstAmount,
              amount,
            },
          ],
        },
      },
      include: INVOICE_INCLUDE,
    });
  }
}
