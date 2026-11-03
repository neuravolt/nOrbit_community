import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { ClientsService } from '../clients/clients.service';
import { BillingService } from '../billing/billing.service';
import { TicketsService } from '../tickets/tickets.service';

describe('Tenant Isolation & Crossover Protection (NORBIT Enterprise Multi-Tenancy)', () => {
  const customerA = {
    id: 'user-a',
    userType: 'CUSTOMER',
    activeOrganizationId: 'org-a',
    role: 'MEMBER',
  };

  const customerB = {
    id: 'user-b',
    userType: 'CUSTOMER',
    activeOrganizationId: 'org-b',
    role: 'MEMBER',
  };

  const staffAdmin = {
    id: 'staff-admin',
    userType: 'STAFF',
    role: 'SUPER_ADMIN',
  };

  describe('Projects Isolation', () => {
    let service: ProjectsService;
    let mockRepo: any;
    let mockPrisma: any;

    beforeEach(() => {
      mockRepo = {
        findById: jest.fn(),
        findAll: jest.fn().mockResolvedValue({ projects: [], total: 0 }),
        create: jest.fn(),
        updateStatus: jest.fn(),
        restore: jest.fn(),
        softDelete: jest.fn(),
        getProjectStats: jest.fn().mockResolvedValue({ taskCount: 0 }),
      };
      mockPrisma = {
        milestone: {
          create: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
      };
      service = new ProjectsService(mockRepo, {} as any, mockPrisma, {} as any);
    });

    it('blocks Customer A from reading a project belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'proj-b',
        name: 'Secret Org B Project',
        organizationId: 'org-b',
      });

      await expect(service.getProjectById('proj-b', customerA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks Customer A from updating a project belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'proj-b',
        name: 'Org B Project',
        organizationId: 'org-b',
      });

      await expect(
        service.updateProject('proj-b', { name: 'Hacked' }, customerA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from updating status of a project belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'proj-b',
        organizationId: 'org-b',
      });

      await expect(
        service.updateProjectStatus(
          'proj-b',
          { status: 'COMPLETED' as any },
          customerA,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from restoring a deleted project belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'proj-b',
        organizationId: 'org-b',
        deletedAt: new Date(),
      });

      await expect(service.restoreProject('proj-b', customerA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks Customer A from creating milestones on a project belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'proj-b',
        organizationId: 'org-b',
      });

      await expect(
        service.createMilestone('proj-b', { name: 'M1' }, customerA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from deleting a project belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'proj-b',
        name: 'Org B Project',
        organizationId: 'org-b',
      });

      await expect(service.deleteProject('proj-b', customerA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks Customer A from accessing an internal staff project (null organizationId)', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'proj-internal',
        name: 'Internal Roadmap',
        organizationId: null,
      });

      await expect(
        service.getProjectById('proj-internal', customerA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('scopes listProjects query strictly to customer activeOrganizationId', async () => {
      await service.listProjects({}, customerA);
      expect(mockRepo.findAll).toHaveBeenCalledWith({}, 'org-a');
    });

    it('allows staff user unrestricted access to any project', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'proj-b',
        name: 'Org B Project',
        organizationId: 'org-b',
      });

      const res = await service.getProjectById('proj-b', staffAdmin);
      expect(res.id).toBe('proj-b');
    });
  });

  describe('Tasks Isolation', () => {
    let service: TasksService;
    let mockRepo: any;
    let mockPrisma: any;

    beforeEach(() => {
      mockRepo = {
        findById: jest.fn(),
        findAll: jest.fn().mockResolvedValue({ tasks: [], total: 0 }),
        create: jest.fn(),
        updateStatus: jest.fn(),
        restore: jest.fn(),
        softDelete: jest.fn(),
        getTaskStats: jest.fn().mockResolvedValue({}),
      };
      mockPrisma = {
        comment: {
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      service = new TasksService(mockRepo, mockPrisma, {} as any);
    });

    it('blocks Customer A from reading a task belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'task-b',
        title: 'Org B Confidential Task',
        organizationId: 'org-b',
      });

      await expect(service.getTaskById('task-b', customerA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks Customer A from updating a task belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'task-b',
        title: 'Org B Task',
        organizationId: 'org-b',
      });

      await expect(
        service.updateTask('task-b', { title: 'Modified' }, customerA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from changing status of a task belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'task-b',
        organizationId: 'org-b',
      });

      await expect(
        service.updateTaskStatus(
          'task-b',
          { status: 'DONE' as any },
          customerA,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from restoring a task belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'task-b',
        organizationId: 'org-b',
        deletedAt: new Date(),
      });

      await expect(service.restoreTask('task-b', customerA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks Customer A from adding comments to a task belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'task-b',
        organizationId: 'org-b',
      });

      await expect(
        service.addComment(
          'task-b',
          'user-a',
          { content: 'Sneaky comment' },
          customerA,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from deleting a task belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'task-b',
        organizationId: 'org-b',
      });

      await expect(service.deleteTask('task-b', customerA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('scopes listTasks query to customer activeOrganizationId', async () => {
      await service.listTasks({}, customerA);
      expect(mockRepo.findAll).toHaveBeenCalledWith({}, 'org-a');
    });
  });

  describe('Clients Isolation', () => {
    let service: ClientsService;
    let mockRepo: any;
    let mockPrisma: any;

    beforeEach(() => {
      mockRepo = {
        findById: jest.fn(),
        findAll: jest.fn().mockResolvedValue({ clients: [], total: 0 }),
        create: jest.fn(),
        restore: jest.fn(),
        countClientProjects: jest.fn().mockResolvedValue(0),
        softDelete: jest.fn(),
        hasActiveProjects: jest.fn().mockResolvedValue(false),
      };
      mockPrisma = {
        clientContact: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      service = new ClientsService(mockRepo, mockPrisma, {} as any);
    });

    it('blocks Customer A from reading a client record belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'client-b',
        name: 'Org B Client',
        organizationId: 'org-b',
      });

      await expect(
        service.getClientById('client-b', customerA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from updating a client record belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'client-b',
        name: 'Org B Client',
        organizationId: 'org-b',
      });

      await expect(
        service.updateClient('client-b', { name: 'Changed' }, customerA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from reading contacts of a client belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'client-b',
        organizationId: 'org-b',
      });

      await expect(
        service.getClientContacts('client-b', customerA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from restoring a client record belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'client-b',
        organizationId: 'org-b',
        deletedAt: new Date(),
      });

      await expect(
        service.restoreClient('client-b', customerA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('scopes listClients query to customer activeOrganizationId', async () => {
      await service.listClients({}, customerA);
      expect(mockRepo.findAll).toHaveBeenCalledWith({}, 'org-a');
    });
  });

  describe('Invoices Isolation', () => {
    let service: BillingService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        invoice: {
          findUnique: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          update: jest.fn(),
          updateMany: jest.fn(),
          delete: jest.fn(),
        },
      };
      service = new BillingService(mockPrisma, {} as any, {} as any, {} as any);
    });

    it('blocks Customer A from reading an invoice belonging to Org B', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-b',
        invoiceNumber: 'INV-2026-001',
        organizationId: 'org-b',
      });

      await expect(service.findOne('inv-b', customerA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks Customer A from sending an invoice belonging to Org B', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-b',
        status: 'draft',
        organizationId: 'org-b',
      });

      await expect(service.send('inv-b', customerA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks Customer A from recording payment on an invoice belonging to Org B', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-b',
        status: 'sent',
        organizationId: 'org-b',
      });

      await expect(
        service.recordPayment(
          'inv-b',
          { amount: 100, method: 'CASH' } as any,
          customerA,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from deleting an invoice belonging to Org B', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-b',
        status: 'draft',
        organizationId: 'org-b',
      });

      await expect(service.delete('inv-b', customerA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('scopes invoice findAll query to customer activeOrganizationId', async () => {
      await service.findAll({}, customerA);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-a' }),
        }),
      );
    });

    it('scopes invoice getOverdue query to customer activeOrganizationId', async () => {
      await service.getOverdue(customerA);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'overdue',
            organizationId: 'org-a',
          }),
        }),
      );
    });
  });

  describe('Tickets Isolation', () => {
    let service: TicketsService;
    let mockRepo: any;
    let mockPrisma: any;

    beforeEach(() => {
      mockRepo = {
        findById: jest.fn(),
        findAll: jest.fn().mockResolvedValue({ tickets: [], total: 0 }),
        create: jest.fn(),
        updateStatus: jest.fn(),
        assign: jest.fn(),
        restore: jest.fn(),
        softDelete: jest.fn(),
        createComment: jest.fn(),
        findCommentsByTicket: jest.fn().mockResolvedValue([]),
        deleteComment: jest.fn(),
      };
      mockPrisma = {
        task: {
          updateMany: jest.fn(),
        },
        comment: {
          findUnique: jest.fn(),
        },
      };
      service = new TicketsService(mockRepo, mockPrisma, {
        handleTicketAssigned: jest.fn().mockResolvedValue(true),
      } as any);
    });

    it('blocks Customer A from reading a ticket belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'ticket-b',
        title: 'Org B Incident',
        organizationId: 'org-b',
      });

      await expect(
        service.getTicketById('ticket-b', customerA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from updating status of a ticket belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'ticket-b',
        status: 'OPEN',
        organizationId: 'org-b',
      });

      await expect(
        service.updateTicketStatus(
          'ticket-b',
          { status: 'IN_PROGRESS' as any },
          customerA,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from assigning a ticket belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'ticket-b',
        organizationId: 'org-b',
      });

      await expect(
        service.assignTicket('ticket-b', 'agent-1', customerA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from restoring a deleted ticket belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'ticket-b',
        organizationId: 'org-b',
        deletedAt: new Date(),
      });

      await expect(
        service.restoreTicket('ticket-b', customerA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks Customer A from adding comments on a ticket belonging to Org B', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'ticket-b',
        organizationId: 'org-b',
      });

      await expect(
        service.addComment(
          'ticket-b',
          'user-a',
          { content: 'Sneaky comment' },
          customerA,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('scopes ticket listTickets query to customer activeOrganizationId', async () => {
      await service.listTickets({}, customerA);
      expect(mockRepo.findAll).toHaveBeenCalledWith({}, 'org-a');
    });
  });
});
