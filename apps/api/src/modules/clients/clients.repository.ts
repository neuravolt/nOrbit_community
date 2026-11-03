import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common';
import { CreateClientDto, UpdateClientDto, ListClientsQuery } from './dto';

@Injectable()
export class ClientsRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return (this.prisma.client as any).findUnique({
      where: { id },
      include: {
        contactPersons: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isPrimary: true,
          },
        },
        clientUsers: {
          select: {
            id: true,
            email: true,
            portalEnabled: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
    });
  }

  async findByEmail(email: string) {
    return (this.prisma.client as any).findUnique({
      where: { email },
      select: { id: true, email: true },
    });
  }

  async findAll(query: ListClientsQuery, organizationId?: string | null) {
    const { page = 1, limit = 20, search, status, industry } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { deletedAt: null };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (industry) {
      where.industry = industry;
    }

    const [clients, total] = await Promise.all([
      (this.prisma.client as any).findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          website: true,
          notes: true,
          state: true,
          tier: true,
          status: true,
          industry: true,
          gstNumber: true,
          collectEnabled: true,
          createdAt: true,
          contactPersons: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              isPrimary: true,
            },
          },
          clientUsers: {
            select: {
              id: true,
              email: true,
              portalEnabled: true,
              isActive: true,
            },
          },
        },
        skip,
        take: Number(limit),

        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma.client as any).count({ where }),
    ]);

    return {
      clients: clients.map((c: any) => ({
        ...c,
        contactCount: c.contactPersons.length,
        projectCount: 0, // Will be populated by service
        contacts: c.contactPersons,
        clientUser:
          c.clientUsers && c.clientUsers.length > 0
            ? {
                id: c.clientUsers[0].id,
                email: c.clientUsers[0].email,
                portalEnabled: c.clientUsers[0].portalEnabled,
                isActive: c.clientUsers[0].isActive,
              }
            : undefined,
        clientUsers: undefined,
      })),
      total,
      page,
      limit,
    };
  }

  async create(data: CreateClientDto, organizationId?: string | null) {
    const { contacts = [], ...clientData } = data;

    return (this.prisma.client as any).create({
      data: {
        ...clientData,
        organizationId: organizationId || undefined,
        status: 'ACTIVE',
        ...(contacts.length > 0 && {
          contactPersons: {
            create: contacts.map((contact) => ({
              name: contact.name,
              email: contact.email || '',
              phone: contact.phone,
              role: contact.role,
              isPrimary: contact.isPrimary,
            })),
          },
        }),
      },
      include: {
        contactPersons: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isPrimary: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateClientDto) {
    const { contacts, ...clientData } = data;

    const updateData: any = clientData;

    // If contacts are provided, replace them
    if (contacts && contacts.length > 0) {
      // Delete existing contacts
      await (this.prisma.contactPerson as any).deleteMany({
        where: { clientId: id },
      });

      updateData.contactPersons = {
        create: contacts.map((contact) => ({
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          role: contact.role,
          isPrimary: contact.isPrimary,
        })),
      };
    }

    return (this.prisma.client as any).update({
      where: { id },
      data: updateData,
      include: {
        contactPersons: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isPrimary: true,
          },
        },
      },
    });
  }

  async softDelete(id: string) {
    return (this.prisma.client as any).update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true, name: true },
    });
  }

  async restore(id: string) {
    return (this.prisma.client as any).update({
      where: { id },
      data: { deletedAt: null },
      include: {
        contactPersons: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isPrimary: true,
          },
        },
      },
    });
  }

  async findContactById(clientId: string, contactId: string) {
    return (this.prisma.contactPerson as any).findFirst({
      where: {
        id: contactId,
        clientId,
      },
    });
  }

  async findClientContacts(clientId: string) {
    return (this.prisma.contactPerson as any).findMany({
      where: { clientId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async updateContact(clientId: string, contactId: string, data: any) {
    // If setting this contact as primary, unset others
    if (data.isPrimary) {
      await (this.prisma.contactPerson as any).updateMany({
        where: { clientId, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }

    return (this.prisma.contactPerson as any).update({
      where: { id: contactId },
      data,
    });
  }

  async deleteContact(contactId: string) {
    return (this.prisma.contactPerson as any).delete({
      where: { id: contactId },
    });
  }

  async countClientProjects(clientId: string) {
    return (this.prisma.project as any).count({
      where: { clientId },
    });
  }

  async hasActiveProjects(clientId: string) {
    const count = await (this.prisma.project as any).count({
      where: {
        clientId,
        status: { not: 'COMPLETED' },
      },
    });

    return count > 0;
  }

  async getPrimaryContact(clientId: string) {
    return (this.prisma.contactPerson as any).findFirst({
      where: { clientId, isPrimary: true },
    });
  }
}
