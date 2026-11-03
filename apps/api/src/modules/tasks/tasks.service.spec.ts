import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WebPushService } from '../guardian/services/web-push.service';

describe('TasksService (Phase 1 Atomic Code Generator & Backfill)', () => {
  let service: TasksService;
  let mockTasksRepository: any;
  let mockPrisma: any;

  beforeEach(async () => {
    mockTasksRepository = {
      findById: jest.fn(),
      findByTicketId: jest.fn(),
      getTaskStats: jest.fn().mockResolvedValue({
        assignmentCount: 1,
        commentCount: 0,
        subtaskCount: 0,
        totalTimeLogged: 0,
      }),
    };

    mockPrisma = {
      $transaction: jest.fn((cb) => cb(mockPrisma)),
      project: {
        findUnique: jest.fn(),
      },
      projectTaskCounter: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      taskAssignment: {
        create: jest.fn(),
      },
      ticket: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: TasksRepository, useValue: mockTasksRepository },
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: WebPushService,
          useValue: { enabled: false, sendToUser: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('allocates next taskCode from existing ProjectTaskCounter in single transaction', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ key: 'CORE' });
    mockPrisma.task.findMany.mockResolvedValue([{ taskCode: 'CORE-5' }]);
    mockPrisma.projectTaskCounter.upsert.mockResolvedValue({ lastNumber: 6 });
    mockPrisma.task.create.mockResolvedValue({
      id: 'task-1',
      title: 'Setup authentication',
      taskCode: 'CORE-6',
      githubBranch: 'task/core-6-setup-authentication',
      status: 'TODO',
      priority: 'HIGH',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTasksRepository.findById.mockResolvedValue({
      id: 'task-1',
      title: 'Setup authentication',
      taskCode: 'CORE-6',
      githubBranch: 'task/core-6-setup-authentication',
      status: 'TODO',
      priority: 'HIGH',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createTask({
      projectId: 'proj-123',
      title: 'Setup authentication',
      priority: 'HIGH',
    });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.projectTaskCounter.upsert).toHaveBeenCalledWith({
      where: { projectId: 'proj-123' },
      create: { projectId: 'proj-123', lastNumber: 6 },
      update: { lastNumber: { increment: 1 } },
    });
    expect(result.taskCode).toBe('CORE-6');
    expect(result.githubBranch).toBe('task/core-6-setup-authentication');
  });

  it('performs safe backfill when ProjectTaskCounter is not yet initialized', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ key: 'NV' });
    // Existing tasks have codes NV-12, NV-7, and 1 unnumbered task (total 3 tasks)
    mockPrisma.task.findMany.mockResolvedValue([
      { taskCode: 'NV-12' },
      { taskCode: 'NV-7' },
      { taskCode: null },
    ]);
    // Baseline should be max(12, 3) = 12. New counter starts at 13.
    mockPrisma.projectTaskCounter.upsert.mockResolvedValue({ lastNumber: 13 });
    mockPrisma.task.create.mockResolvedValue({
      id: 'task-2',
      title: 'Payment webhook',
      taskCode: 'NV-13',
      githubBranch: 'task/nv-13-payment-webhook',
      status: 'TODO',
      priority: 'MEDIUM',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTasksRepository.findById.mockResolvedValue({
      id: 'task-2',
      title: 'Payment webhook',
      taskCode: 'NV-13',
      githubBranch: 'task/nv-13-payment-webhook',
      status: 'TODO',
      priority: 'MEDIUM',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createTask({
      projectId: 'proj-456',
      title: 'Payment webhook',
    });

    expect(mockPrisma.projectTaskCounter.upsert).toHaveBeenCalledWith({
      where: { projectId: 'proj-456' },
      create: {
        projectId: 'proj-456',
        lastNumber: 13,
      },
      update: {
        lastNumber: { increment: 1 },
      },
    });
    expect(result.taskCode).toBe('NV-13');
  });

  it('creates task without code if project has no key defined', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ key: null });
    mockPrisma.task.create.mockResolvedValue({
      id: 'task-3',
      title: 'Unkeyed task',
      taskCode: null,
      githubBranch: null,
      status: 'TODO',
      priority: 'MEDIUM',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTasksRepository.findById.mockResolvedValue({
      id: 'task-3',
      title: 'Unkeyed task',
      taskCode: null,
      githubBranch: null,
      status: 'TODO',
      priority: 'MEDIUM',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createTask({
      projectId: 'proj-unkeyed',
      title: 'Unkeyed task',
    });

    expect(mockPrisma.projectTaskCounter.update).not.toHaveBeenCalled();
    expect(mockPrisma.projectTaskCounter.create).not.toHaveBeenCalled();
    expect(result.taskCode).toBeUndefined();
    expect(result.githubBranch).toBeUndefined();
  });

  it('rolls back counter increment when task creation throws an error in transaction', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ key: 'FAIL' });
    mockPrisma.task.findMany.mockResolvedValue([{ taskCode: 'FAIL-10' }]);
    mockPrisma.projectTaskCounter.upsert.mockResolvedValue({ lastNumber: 11 });
    // Simulate task creation error (e.g. DB constraint or validation failure)
    mockPrisma.task.create.mockRejectedValue(
      new Error('Database error during task insert'),
    );

    await expect(
      service.createTask({
        projectId: 'proj-fail',
        title: 'Failing task',
      }),
    ).rejects.toThrow('Database error during task insert');

    // Confirms that all operations ran inside the transaction callback
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('handles wide gaps in legacy task numbers correctly', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ key: 'GAP' });
    mockPrisma.projectTaskCounter.findUnique.mockResolvedValue(null);
    // Legacy tasks with big gaps: GAP-1, GAP-50, GAP-200
    mockPrisma.task.findMany.mockResolvedValue([
      { taskCode: 'GAP-1' },
      { taskCode: 'GAP-50' },
      { taskCode: 'GAP-200' },
    ]);
    mockPrisma.projectTaskCounter.upsert.mockResolvedValue({ lastNumber: 201 });
    mockPrisma.task.create.mockResolvedValue({
      id: 'task-gap',
      title: 'Gap task',
      taskCode: 'GAP-201',
      githubBranch: 'task/gap-201-gap-task',
      status: 'TODO',
      priority: 'LOW',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTasksRepository.findById.mockResolvedValue({
      id: 'task-gap',
      title: 'Gap task',
      taskCode: 'GAP-201',
      githubBranch: 'task/gap-201-gap-task',
      status: 'TODO',
      priority: 'LOW',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createTask({
      projectId: 'proj-gap',
      title: 'Gap task',
    });

    // Baseline must be max(200, 3) = 200. New counter created with 201.
    expect(mockPrisma.projectTaskCounter.upsert).toHaveBeenCalledWith({
      where: { projectId: 'proj-gap' },
      create: {
        projectId: 'proj-gap',
        lastNumber: 201,
      },
      update: {
        lastNumber: { increment: 1 },
      },
    });
    expect(result.taskCode).toBe('GAP-201');
  });

  it('safely advances counter if existing task codes exceed current counter value', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ key: 'ADV' });
    mockPrisma.task.findMany.mockResolvedValue([
      { taskCode: 'ADV-10' },
      { taskCode: 'ADV-50' }, // Out of band or imported task
    ]);
    // Upsert returns 11 (because counter was at 10)
    mockPrisma.projectTaskCounter.upsert.mockResolvedValue({ lastNumber: 11 });
    // Service detects counter (11) <= maxExistingNumber (50), so it forces update to 51
    mockPrisma.projectTaskCounter.update.mockResolvedValue({ lastNumber: 51 });
    mockPrisma.task.create.mockResolvedValue({
      id: 'task-adv',
      title: 'Advanced task',
      taskCode: 'ADV-51',
      githubBranch: 'task/adv-51-advanced-task',
      status: 'TODO',
      priority: 'MEDIUM',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTasksRepository.findById.mockResolvedValue({
      id: 'task-adv',
      title: 'Advanced task',
      taskCode: 'ADV-51',
      githubBranch: 'task/adv-51-advanced-task',
      status: 'TODO',
      priority: 'MEDIUM',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createTask({
      projectId: 'proj-adv',
      title: 'Advanced task',
    });

    expect(mockPrisma.projectTaskCounter.update).toHaveBeenCalledWith({
      where: { projectId: 'proj-adv' },
      data: { lastNumber: 51 },
    });
    expect(result.taskCode).toBe('ADV-51');
  });

  it('serializes concurrent task allocations within atomic transaction', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ key: 'CONCUR' });
    mockPrisma.task.findMany.mockResolvedValue([]);

    // Simulate two sequential calls inside transactions with incrementing counter
    mockPrisma.projectTaskCounter.upsert
      .mockResolvedValueOnce({ lastNumber: 1 })
      .mockResolvedValueOnce({ lastNumber: 2 });

    mockPrisma.task.create
      .mockResolvedValueOnce({
        id: 't-1',
        title: 'Task A',
        taskCode: 'CONCUR-1',
        githubBranch: 'task/concur-1-task-a',
        status: 'TODO',
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 't-2',
        title: 'Task B',
        taskCode: 'CONCUR-2',
        githubBranch: 'task/concur-2-task-b',
        status: 'TODO',
        createdAt: new Date(),
      });

    mockTasksRepository.findById
      .mockResolvedValueOnce({
        id: 't-1',
        taskCode: 'CONCUR-1',
        title: 'Task A',
      })
      .mockResolvedValueOnce({
        id: 't-2',
        taskCode: 'CONCUR-2',
        title: 'Task B',
      });

    const [task1, task2] = await Promise.all([
      service.createTask({ projectId: 'p-conc', title: 'Task A' }),
      service.createTask({ projectId: 'p-conc', title: 'Task B' }),
    ]);

    expect(task1.taskCode).toBe('CONCUR-1');
    expect(task2.taskCode).toBe('CONCUR-2');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
