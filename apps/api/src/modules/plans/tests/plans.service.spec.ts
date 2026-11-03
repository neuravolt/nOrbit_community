import { Test, TestingModule } from '@nestjs/testing';
import { PlansService } from '../plans.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('PlansService', () => {
  let service: PlansService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      plan: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlansService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PlansService>(PlansService);
  });

  describe('createPlan', () => {
    it('creates a new plan successfully', async () => {
      prisma.plan.findFirst.mockResolvedValue(null);
      const createdPlan = {
        id: 'plan-1',
        name: 'Growth',
        slug: 'growth',
        maxMembers: 20,
        isActive: true,
      };
      prisma.plan.create.mockResolvedValue(createdPlan);

      const result = await service.createPlan({
        name: 'Growth',
        slug: 'growth',
        maxMembers: 20,
      });

      expect(result).toEqual(createdPlan);
      expect(prisma.plan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Growth',
            slug: 'growth',
            maxMembers: 20,
          }),
        }),
      );
    });

    it('rejects duplicate plan name or slug with ConflictException', async () => {
      prisma.plan.findFirst.mockResolvedValue({
        id: 'existing',
        name: 'Growth',
        slug: 'growth',
      });

      await expect(
        service.createPlan({ name: 'Growth', slug: 'growth' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects blank plan name or slug', async () => {
      await expect(
        service.createPlan({ name: '   ', slug: 'growth' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listAllPlans & getPublicPlans', () => {
    it('returns all plans for admin', async () => {
      const plans = [
        { id: '1', name: 'Starter' },
        { id: '2', name: 'Enterprise' },
      ];
      prisma.plan.findMany.mockResolvedValue(plans);

      const result = await service.listAllPlans(true);
      expect(result).toEqual(plans);
      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('returns only public and active plans for self-serve customers', async () => {
      const publicPlans = [
        { id: '1', name: 'Starter', isPublic: true, isActive: true },
      ];
      prisma.plan.findMany.mockResolvedValue(publicPlans);

      const result = await service.getPublicPlans();
      expect(result).toEqual(publicPlans);
      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true, isPublic: true, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('updatePlan & deactivatePlan', () => {
    it('updates plan attributes cleanly', async () => {
      prisma.plan.findFirst.mockResolvedValueOnce({
        id: 'plan-1',
        name: 'Starter',
        slug: 'starter',
      });
      prisma.plan.findFirst.mockResolvedValueOnce(null); // No conflict
      prisma.plan.update.mockResolvedValue({
        id: 'plan-1',
        name: 'Starter Pro',
        slug: 'starter',
      });

      const result = await service.updatePlan('plan-1', {
        name: 'Starter Pro',
      });
      expect(result.name).toBe('Starter Pro');
    });

    it('deactivates a plan by setting isActive false', async () => {
      prisma.plan.findFirst.mockResolvedValueOnce({
        id: 'plan-1',
        isActive: true,
      });
      prisma.plan.update.mockResolvedValue({ id: 'plan-1', isActive: false });

      const result = await service.deactivatePlan('plan-1');
      expect(result.isActive).toBe(false);
      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { isActive: false },
      });
    });
  });
});
