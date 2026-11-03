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
  Req,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import {
  CreateLeadDto,
  CaptureLeadDto,
  UpdateLeadDto,
  ConvertLeadDto,
  ListLeadsQuery,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import {
  PermissionsGuard,
  Permissions,
} from '../roles/guards/permissions.guard';
import { LeadsApiKeyGuard } from './guards/leads-api-key.guard';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  /**
   * Public Webhook & Form Ingestion Endpoint
   * Authenticated via x-api-key header or ?api_key= query parameter.
   */
  @Post('capture')
  @UseGuards(LeadsApiKeyGuard)
  async captureLead(@Body() captureLeadDto: CaptureLeadDto) {
    return this.leadsService.captureLead(captureLeadDto);
  }

  /**
   * Retrieve active Lead Ingestion API Key (Admin/Manager only)
   */
  @Get('api-key')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['leads:read'])
  async getApiKey() {
    return this.leadsService.getApiKey();
  }

  /**
   * Regenerate Lead Ingestion API Key (Super Admin only)
   */
  @Post('api-key/regenerate')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN'])
  @Permissions(['leads:create'])
  async regenerateApiKey() {
    return this.leadsService.regenerateApiKey();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER', 'SALES'])
  @Permissions(['leads:create'])
  async createLead(@Body() createLeadDto: CreateLeadDto, @Req() req: any) {
    return this.leadsService.createLead(createLeadDto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER', 'SALES', 'EMPLOYEE'])
  @Permissions(['leads:read'])
  async listLeads(@Query() query: ListLeadsQuery, @Req() req: any) {
    return this.leadsService.listLeads(query, req.user);
  }

  @Get('metrics/conversion')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER', 'SALES'])
  @Permissions(['leads:read'])
  async getConversionMetrics() {
    return this.leadsService.getConversionMetrics();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER', 'SALES', 'EMPLOYEE'])
  @Permissions(['leads:read'])
  async getLeadById(@Param('id') id: string, @Req() req: any) {
    return this.leadsService.getLeadById(id, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER', 'SALES'])
  @Permissions(['leads:update'])
  async updateLead(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
  ) {
    return this.leadsService.updateLead(id, updateLeadDto);
  }

  @Patch(':id/convert')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER', 'SALES'])
  @Permissions(['leads:convert'])
  async convertLeadToClient(
    @Param('id') id: string,
    @Body() convertLeadDto?: ConvertLeadDto,
  ) {
    return this.leadsService.convertLeadToClient(id, convertLeadDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['leads:delete'])
  async deleteLead(@Param('id') id: string) {
    return this.leadsService.deleteLead(id);
  }

  @Patch(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['leads:restore'])
  async restoreLead(@Param('id') id: string) {
    return this.leadsService.restoreLead(id);
  }
}
