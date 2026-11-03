import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { ClientsRepository } from '../clients/clients.repository';
import {
  CreateLeadDto,
  CaptureLeadDto,
  UpdateLeadDto,
  ConvertLeadDto,
  ListLeadsQuery,
  LeadDto,
  ListLeadsResponseDto,
  ConvertedClientDto,
} from './dto';
import * as crypto from 'crypto';

@Injectable()
export class LeadsService {
  private readonly VALID_STATUSES = [
    'new',
    'contacted',
    'qualified',
    'converted',
    'lost',
  ];
  private readonly VALID_SOURCES = [
    'Website',
    'Referral',
    'LinkedIn',
    'Cold Outreach',
    'Other',
  ];
  private readonly STATUS_WORKFLOW: Record<string, string[]> = {
    new: ['contacted', 'lost'],
    contacted: ['qualified', 'lost'],
    qualified: ['converted', 'lost'],
    converted: [],
    lost: [],
  };

  constructor(
    private readonly leadsRepository: LeadsRepository,
    private readonly clientsRepository: ClientsRepository,
  ) {}

  async createLead(
    createLeadDto: CreateLeadDto,
    user?: any,
  ): Promise<LeadDto> {
    // Validate source if provided
    if (
      createLeadDto.source &&
      !this.VALID_SOURCES.includes(createLeadDto.source)
    ) {
      throw new BadRequestException(
        `Invalid source. Valid options: ${this.VALID_SOURCES.join(', ')}`,
      );
    }

    // Check email uniqueness if provided
    if (createLeadDto.email) {
      const existingLead = await this.leadsRepository.findByEmail(
        createLeadDto.email,
      );
      if (existingLead) {
        throw new ConflictException('Lead with this email already exists');
      }
    }

    let notes = createLeadDto.notes ? createLeadDto.notes.trim() : '';
    if (createLeadDto.service) {
      const tag = `[Service: ${createLeadDto.service.trim()}]`;
      notes = notes ? `${tag}\n${notes}` : tag;
    }

    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;

    const lead = await this.leadsRepository.create({
      ...createLeadDto,
      organizationId: orgId,
      notes: notes || undefined,
    } as any);
    return this.mapToLeadDto(lead);
  }

  async listLeads(
    query: ListLeadsQuery,
    user?: any,
  ): Promise<ListLeadsResponseDto> {
    // Validate status if provided
    if (query.status && !this.VALID_STATUSES.includes(query.status)) {
      throw new BadRequestException(
        `Invalid status. Valid options: ${this.VALID_STATUSES.join(', ')}`,
      );
    }

    // Validate source if provided
    if (query.source && !this.VALID_SOURCES.includes(query.source)) {
      throw new BadRequestException(
        `Invalid source. Valid options: ${this.VALID_SOURCES.join(', ')}`,
      );
    }

    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const result = await this.leadsRepository.findAll(query, orgId);

    return {
      leads: result.leads.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone,
        company: l.company,
        source: l.source,
        status: l.status,
        estimatedValue: l.estimatedValue,
        notes: l.notes,
        convertedToClientId: l.convertedToClientId,
        createdAt: l.createdAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getLeadById(id: string, user?: any): Promise<LeadDto> {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    if (
      user?.userType === 'CUSTOMER' &&
      lead.organizationId &&
      lead.organizationId !== user.activeOrganizationId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapToLeadDto(lead);
  }

  async updateLead(id: string, updateLeadDto: UpdateLeadDto): Promise<LeadDto> {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Validate status transition if status is being updated
    if (updateLeadDto.status && updateLeadDto.status !== lead.status) {
      const validNextStatuses = this.STATUS_WORKFLOW[lead.status] || [];
      if (!validNextStatuses.includes(updateLeadDto.status)) {
        throw new BadRequestException(
          `Cannot transition from '${lead.status}' to '${updateLeadDto.status}'. Valid transitions: ${validNextStatuses.join(', ')}`,
        );
      }
    }

    // Validate source if provided
    if (
      updateLeadDto.source &&
      !this.VALID_SOURCES.includes(updateLeadDto.source)
    ) {
      throw new BadRequestException(
        `Invalid source. Valid options: ${this.VALID_SOURCES.join(', ')}`,
      );
    }

    // Check email uniqueness if being changed
    if (updateLeadDto.email && updateLeadDto.email !== lead.email) {
      const existingLead = await this.leadsRepository.findByEmail(
        updateLeadDto.email,
      );
      if (existingLead) {
        throw new ConflictException('Lead with this email already exists');
      }
    }

    const updated = await this.leadsRepository.update(id, updateLeadDto);
    return this.mapToLeadDto(updated);
  }

  async convertLeadToClient(
    leadId: string,
    convertLeadDto?: ConvertLeadDto,
  ): Promise<ConvertedClientDto> {
    const lead = await this.leadsRepository.findById(leadId);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Check if already converted
    if (lead.convertedToClientId) {
      throw new BadRequestException(
        'Lead has already been converted to a client',
      );
    }

    // Create client from lead data with full billing & tax info
    const clientName =
      convertLeadDto?.clientName?.trim() || lead.company || lead.name;
    const contactName = convertLeadDto?.contactName?.trim() || lead.name;
    const contactRole = convertLeadDto?.contactRole || 'Owner';

    const client = await this.clientsRepository.create({
      name: clientName,
      email: convertLeadDto?.email?.trim() || lead.email || undefined,
      phone: convertLeadDto?.phone?.trim() || lead.phone || undefined,
      address: convertLeadDto?.address?.trim() || undefined,
      gstNumber: convertLeadDto?.gstNumber?.trim() || undefined,
      state: convertLeadDto?.state?.trim() || undefined,
      website: convertLeadDto?.website?.trim() || undefined,
      industry: convertLeadDto?.industry?.trim() || undefined,
      notes: convertLeadDto?.notes?.trim() || lead.notes || undefined,
      contacts: [
        {
          name: contactName,
          email: convertLeadDto?.email?.trim() || lead.email || '',
          phone: convertLeadDto?.phone?.trim() || lead.phone,
          role: contactRole,
          isPrimary: true,
        },
      ],
    });

    // Mark lead as converted
    await this.leadsRepository.markAsConverted(leadId, client.id);

    return this.mapToConvertedClientDto(client);
  }

  async deleteLead(id: string): Promise<{ message: string }> {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    await this.leadsRepository.softDelete(id);
    return { message: 'Lead deleted successfully' };
  }

  async restoreLead(id: string): Promise<LeadDto> {
    const lead = await this.leadsRepository.findById(id);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const restored = await this.leadsRepository.restore(id);
    return this.mapToLeadDto(restored);
  }

  async getConversionMetrics() {
    return this.leadsRepository.getConversionMetrics();
  }

  private mapToLeadDto(lead: any): LeadDto {
    return {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      source: lead.source,
      status: lead.status,
      estimatedValue: lead.estimatedValue,
      notes: lead.notes,
      convertedToClientId: lead.convertedToClientId,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }

  private mapToConvertedClientDto(client: any): ConvertedClientDto {
    return {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      website: client.website,
      status: client.status,
      industry: client.industry,
      contacts:
        client.contactPersons?.map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          role: c.role,
          isPrimary: c.isPrimary,
        })) || [],
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  private currentApiKey =
    process.env.LEADS_CAPTURE_API_KEY ||
    'nv_lead_live_f8b7e8994670d1513feeb751a09fe2fc';

  validateApiKey(providedKey: string): boolean {
    if (!providedKey || typeof providedKey !== 'string') return false;
    const targetKey = this.currentApiKey;
    if (providedKey.length !== targetKey.length) return false;
    try {
      return crypto.timingSafeEqual(
        Buffer.from(providedKey, 'utf8'),
        Buffer.from(targetKey, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  getApiKey(): { apiKey: string; endpoint: string; hint: string } {
    return {
      apiKey: this.currentApiKey,
      endpoint: '/leads/capture',
      hint: 'Include this key in the x-api-key HTTP header when sending POST requests.',
    };
  }

  regenerateApiKey(): { apiKey: string; message: string } {
    const newKey = `nv_lead_live_${crypto.randomBytes(16).toString('hex')}`;
    this.currentApiKey = newKey;
    process.env.LEADS_CAPTURE_API_KEY = newKey;
    return {
      apiKey: newKey,
      message:
        'Lead capture API key successfully regenerated. Please update your external website forms.',
    };
  }

  async captureLead(captureLeadDto: CaptureLeadDto): Promise<{
    success: boolean;
    message: string;
    leadId: string;
    isNew: boolean;
  }> {
    const source = captureLeadDto.source || 'Website';
    let leadNote = captureLeadDto.notes ? captureLeadDto.notes.trim() : '';
    const tags: string[] = [];
    if (captureLeadDto.service) {
      tags.push(`[Service: ${captureLeadDto.service.trim()}]`);
    }
    if (captureLeadDto.website) {
      tags.push(`[Source Domain: ${captureLeadDto.website.trim()}]`);
    }
    if (tags.length > 0) {
      const header = tags.join(' ');
      leadNote = leadNote ? `${header}\n${leadNote}` : header;
    }

    // If an existing lead with this email exists, append inquiry rather than rejecting
    if (captureLeadDto.email) {
      const existing = await this.leadsRepository.findByEmail(
        captureLeadDto.email.trim(),
      );
      if (existing) {
        const timestamp = new Date().toISOString();
        const appendText = `\n\n--- Subsequent Inquiry [${timestamp}] ---\n${leadNote || 'Form re-submitted by client'}`;
        const updatedNotes = (existing.notes || '') + appendText;

        const updated = await this.leadsRepository.update(existing.id, {
          notes: updatedNotes,
          phone: captureLeadDto.phone || existing.phone,
          company: captureLeadDto.company || existing.company,
        });

        return {
          success: true,
          message: 'Inquiry successfully added to existing lead profile.',
          leadId: updated.id,
          isNew: false,
        };
      }
    }

    // Otherwise create brand new lead
    const newLead = await this.leadsRepository.create({
      name: captureLeadDto.name.trim(),
      email: captureLeadDto.email ? captureLeadDto.email.trim() : undefined,
      phone: captureLeadDto.phone ? captureLeadDto.phone.trim() : undefined,
      company: captureLeadDto.company
        ? captureLeadDto.company.trim()
        : undefined,
      source: this.VALID_SOURCES.includes(source) ? source : 'Website',
      estimatedValue: captureLeadDto.estimatedValue,
      notes: leadNote || undefined,
    });

    return {
      success: true,
      message: 'Lead successfully captured.',
      leadId: newLead.id,
      isNew: true,
    };
  }
}
