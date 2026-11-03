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
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto, ListClientsQuery } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../users/guards/roles.guard';
import {
  PermissionsGuard,
  Permissions,
} from '../roles/guards/permissions.guard';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['clients:create'])
  async createClient(
    @Body() createClientDto: CreateClientDto,
    @Req() req: any,
  ) {
    return this.clientsService.createClient(createClientDto, req?.user);
  }

  @Get()
  @Roles(['SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'])
  @Permissions(['clients:read'])
  async listClients(@Query() query: ListClientsQuery, @Req() req: any) {
    return this.clientsService.listClients(query, req?.user);
  }

  @Get(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'])
  @Permissions(['clients:read'])
  async getClientById(@Param('id') id: string, @Req() req: any) {
    return this.clientsService.getClientById(id, req?.user);
  }

  @Patch(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['clients:update'])
  async updateClient(
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
    @Req() req: any,
  ) {
    return this.clientsService.updateClient(id, updateClientDto, req?.user);
  }

  @Delete(':id')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['clients:delete'])
  async deleteClient(@Param('id') id: string, @Req() req: any) {
    return this.clientsService.deleteClient(id, req?.user);
  }

  @Patch(':id/restore')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['clients:restore'])
  async restoreClient(@Param('id') id: string, @Req() req: any) {
    return this.clientsService.restoreClient(id, req?.user);
  }

  @Get(':clientId/contacts')
  @Roles(['SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'])
  @Permissions(['clients:read'])
  async getClientContacts(
    @Param('clientId') clientId: string,
    @Req() req: any,
  ) {
    return this.clientsService.getClientContacts(clientId, req?.user);
  }

  @Patch(':clientId/contacts/:contactId')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['clients:update'])
  async updateContact(
    @Param('clientId') clientId: string,
    @Param('contactId') contactId: string,
    @Body() data: any,
    @Req() req: any,
  ) {
    return this.clientsService.updateContact(
      clientId,
      contactId,
      data,
      req?.user,
    );
  }

  @Delete(':clientId/contacts/:contactId')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['clients:delete'])
  async deleteContact(
    @Param('clientId') clientId: string,
    @Param('contactId') contactId: string,
    @Req() req: any,
  ) {
    return this.clientsService.deleteContact(clientId, contactId, req?.user);
  }

  @Post(':id/portal/enable')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['clients:update'])
  async enablePortal(@Param('id') id: string, @Req() req: any) {
    return this.clientsService.enablePortal(id, req?.user);
  }

  @Post(':id/portal/disable')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['clients:update'])
  async disablePortal(@Param('id') id: string, @Req() req: any) {
    return this.clientsService.disablePortal(id, req?.user);
  }

  @Post(':id/portal/reset-password')
  @Roles(['SUPER_ADMIN', 'MANAGER'])
  @Permissions(['clients:update'])
  async resetPortalPassword(@Param('id') id: string, @Req() req: any) {
    return this.clientsService.resetPortalPassword(id, req?.user);
  }
}
