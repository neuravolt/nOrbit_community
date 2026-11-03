import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ClientsRepository } from './clients.repository';
import {
  CreateClientDto,
  UpdateClientDto,
  ListClientsQuery,
  ClientDto,
  ClientListDto,
  ListClientsResponseDto,
  ContactPersonResponseDto,
} from './dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ClientsService {
  constructor(
    private readonly clientsRepository: ClientsRepository,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createClient(
    createClientDto: CreateClientDto,
    user?: any,
  ): Promise<ClientDto> {
    const { email, contacts = [] } = createClientDto;

    // If contacts provided, validate exactly one primary
    if (contacts.length > 0) {
      const primaryContacts = contacts.filter((c) => c.isPrimary);
      if (primaryContacts.length !== 1) {
        // Auto-fix: mark first contact as primary
        contacts[0].isPrimary = true;
        for (let i = 1; i < contacts.length; i++) contacts[i].isPrimary = false;
      }
    }

    // Check email uniqueness if provided
    if (email) {
      const existingClient = await this.clientsRepository.findByEmail(email);
      if (existingClient) {
        throw new ConflictException('Email already in use by another client');
      }
    }

    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const client = await this.clientsRepository.create(
      {
        ...createClientDto,
        contacts,
      },
      orgId,
    );
    return this.mapToClientDto(client, 0);
  }

  async listClients(
    query: ListClientsQuery,
    user?: any,
  ): Promise<ListClientsResponseDto> {
    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const result = await this.clientsRepository.findAll(query, orgId);

    return {
      clients: result.clients,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getClientById(id: string, user?: any): Promise<ClientDto> {
    const client = await this.clientsRepository.findById(id);
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !client.organizationId ||
        client.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this client');
      }
    }

    const projectCount = await this.clientsRepository.countClientProjects(id);
    return this.mapToClientDto(client, projectCount);
  }

  async updateClient(
    id: string,
    updateClientDto: UpdateClientDto,
    user?: any,
  ): Promise<ClientDto> {
    const existingClient = await this.clientsRepository.findById(id);
    if (!existingClient) {
      throw new NotFoundException('Client not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !existingClient.organizationId ||
        existingClient.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this client');
      }
    }

    // Check email uniqueness if being changed
    if (
      updateClientDto.email &&
      updateClientDto.email !== existingClient.email
    ) {
      const emailExists = await this.clientsRepository.findByEmail(
        updateClientDto.email,
      );
      if (emailExists) {
        throw new ConflictException('Email already in use by another client');
      }
    }

    // Validate contacts if provided
    if (updateClientDto.contacts && updateClientDto.contacts.length > 0) {
      const primaryContacts = updateClientDto.contacts.filter(
        (c) => c.isPrimary,
      );
      if (primaryContacts.length !== 1) {
        throw new BadRequestException(
          'Exactly one contact person must be marked as primary',
        );
      }
    }

    const updated = await this.clientsRepository.update(id, updateClientDto);

    // Sync to ClientUser portal credentials if exists
    const primaryContact = updateClientDto.contacts?.find((c) => c.isPrimary);
    if (
      primaryContact ||
      updateClientDto.email ||
      updateClientDto.name ||
      updateClientDto.phone
    ) {
      const clientUser = await this.prisma.clientUser.findUnique({
        where: { clientId: id },
      });
      if (clientUser) {
        await this.prisma.clientUser.update({
          where: { id: clientUser.id },
          data: {
            email:
              primaryContact?.email ??
              (updateClientDto.email !== undefined
                ? updateClientDto.email
                : undefined),
            name:
              primaryContact?.name ??
              (updateClientDto.name !== undefined
                ? updateClientDto.name
                : undefined),
            phone:
              primaryContact?.phone ??
              (updateClientDto.phone !== undefined
                ? updateClientDto.phone
                : undefined),
          },
        });
      }
    }

    const projectCount = await this.clientsRepository.countClientProjects(id);

    return this.mapToClientDto(updated, projectCount);
  }

  async deleteClient(id: string, user?: any): Promise<{ message: string }> {
    const client = await this.clientsRepository.findById(id);
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !client.organizationId ||
        client.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have permission to delete this client',
        );
      }
    }

    // Check for active projects
    const hasActiveProjects =
      await this.clientsRepository.hasActiveProjects(id);
    if (hasActiveProjects) {
      throw new BadRequestException(
        'Cannot delete client with active projects',
      );
    }

    await this.clientsRepository.softDelete(id);
    return { message: 'Client deleted successfully' };
  }

  async restoreClient(id: string, user?: any): Promise<ClientDto> {
    const client = await this.clientsRepository.findById(id);
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !client.organizationId ||
        client.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have permission to restore this client',
        );
      }
    }

    const restored = await this.clientsRepository.restore(id);
    const projectCount = await this.clientsRepository.countClientProjects(id);

    return this.mapToClientDto(restored, projectCount);
  }

  async getClientContacts(
    clientId: string,
    user?: any,
  ): Promise<ContactPersonResponseDto[]> {
    const client = await this.clientsRepository.findById(clientId);
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !client.organizationId ||
        client.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this client');
      }
    }

    const contacts = await this.clientsRepository.findClientContacts(clientId);
    return contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      role: c.role,
      isPrimary: c.isPrimary,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async updateContact(
    clientId: string,
    contactId: string,
    data: any,
    user?: any,
  ): Promise<ContactPersonResponseDto> {
    const client = await this.clientsRepository.findById(clientId);
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !client.organizationId ||
        client.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this client');
      }
    }

    const contact = await this.clientsRepository.findContactById(
      clientId,
      contactId,
    );
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const updated = await this.clientsRepository.updateContact(
      clientId,
      contactId,
      data,
    );
    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      isPrimary: updated.isPrimary,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteContact(
    clientId: string,
    contactId: string,
    user?: any,
  ): Promise<{ message: string }> {
    const client = await this.clientsRepository.findById(clientId);
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !client.organizationId ||
        client.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException(
          'You do not have permission to delete this contact',
        );
      }
    }

    const contact = await this.clientsRepository.findContactById(
      clientId,
      contactId,
    );
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Check if it's the primary contact
    const allContacts =
      await this.clientsRepository.findClientContacts(clientId);
    if (allContacts.length === 1) {
      throw new BadRequestException(
        'Cannot delete the only contact person for a client',
      );
    }

    await this.clientsRepository.deleteContact(contactId);
    return { message: 'Contact deleted successfully' };
  }

  private mapToClientDto(client: any, projectCount: number): ClientDto {
    // Use safe fallbacks for included relations that may be absent
    // depending on which repository method called this mapper.
    const contactPersons: any[] = client.contactPersons ?? [];
    const clientUsers: any[] = client.clientUsers ?? [];

    return {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      website: client.website,
      status: client.status,
      industry: client.industry,
      gstNumber: client.gstNumber,
      notes: client.notes,
      contacts: contactPersons.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        role: c.role,
        isPrimary: c.isPrimary,
      })),
      clientUser:
        clientUsers.length > 0
          ? {
              id: clientUsers[0].id,
              email: clientUsers[0].email,
              portalEnabled: clientUsers[0].portalEnabled,
              isActive: clientUsers[0].isActive,
              lastLoginAt: clientUsers[0].lastLoginAt,
            }
          : undefined,
      projectCount,
      collectEnabled: Boolean(client.collectEnabled),
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  async enablePortal(clientId: string, user?: any) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { contactPersons: true },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !client.organizationId ||
        client.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this client');
      }
    }

    if (!client.email) {
      throw new BadRequestException(
        'Client must have an email address to enable portal access',
      );
    }

    let clientUser = await this.prisma.clientUser.findUnique({
      where: { clientId },
    });

    const primaryContact = client.contactPersons.find((c) => c.isPrimary);
    const name = primaryContact?.name || client.name;
    const phone = client.phone || primaryContact?.phone || null;

    if (clientUser) {
      if (clientUser.portalEnabled) {
        return {
          message: 'Portal access is already enabled for this client',
          email: clientUser.email,
        };
      }

      await this.prisma.clientUser.update({
        where: { id: clientUser.id },
        data: {
          portalEnabled: true,
          isActive: true,
          email: client.email,
          name,
          phone,
        },
      });

      return {
        message: 'Portal access re-enabled successfully',
        email: client.email,
      };
    }

    // Generate random password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      '!' +
      Math.floor(Math.random() * 100);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    clientUser = await this.prisma.clientUser.create({
      data: {
        clientId,
        email: client.email,
        passwordHash,
        name,
        phone,
        portalEnabled: true,
        isActive: true,
        firstLogin: true,
      },
    });

    // Send email credentials
    await this.notificationsService.handleClientPortalAccessCreated(
      client.email,
      name,
      tempPassword,
      clientId,
    );

    return {
      message: 'Portal access enabled and credentials emailed successfully',
      email: client.email,
      tempPassword,
    };
  }

  async disablePortal(clientId: string, user?: any) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !client.organizationId ||
        client.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this client');
      }
    }

    const clientUser = await this.prisma.clientUser.findUnique({
      where: { clientId },
    });

    if (!clientUser) {
      throw new NotFoundException('Client portal user not found');
    }

    await this.prisma.clientUser.update({
      where: { id: clientUser.id },
      data: {
        portalEnabled: false,
        isActive: false,
      },
    });

    return { message: 'Portal access disabled successfully' };
  }

  async resetPortalPassword(clientId: string, user?: any) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { contactPersons: true },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (user?.userType === 'CUSTOMER') {
      if (
        !client.organizationId ||
        client.organizationId !== user.activeOrganizationId
      ) {
        throw new ForbiddenException('You do not have access to this client');
      }
    }

    const clientUser = await this.prisma.clientUser.findUnique({
      where: { clientId },
    });

    if (!clientUser) {
      throw new NotFoundException('Client portal user not found');
    }

    // Generate random password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      '!' +
      Math.floor(Math.random() * 100);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const primaryContact = client.contactPersons.find((c) => c.isPrimary);
    const name = primaryContact?.name || client.name;
    const phone = client.phone || primaryContact?.phone || null;

    await this.prisma.clientUser.update({
      where: { id: clientUser.id },
      data: {
        passwordHash,
        email: client.email || clientUser.email,
        name,
        phone,
        firstLogin: true,
      },
    });

    // Send email credentials
    await this.notificationsService.handleClientPortalAccessCreated(
      client.email || clientUser.email,
      name,
      tempPassword,
      clientId,
    );

    return {
      message: 'Portal password reset successfully and credentials emailed.',
      email: client.email || clientUser.email,
      tempPassword,
    };
  }
}
