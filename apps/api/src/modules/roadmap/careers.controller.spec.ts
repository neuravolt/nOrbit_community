import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CareerController } from './controllers/career.controller';
import { CareerService } from './services/career.service';
import { CreateCareerDto, UpdateCareerDto } from './dto/career.dto';

describe('CareerController', () => {
  let controller: CareerController;
  let service: CareerService;

  const mockCareer = {
    id: 'career-uuid-1',
    name: 'Technology',
    slug: 'technology',
    description: 'Tech Career',
    icon: 'code',
    color: '#ff0000',
    sortOrder: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCareerService = {
    findAll: jest.fn().mockResolvedValue({
      items: [mockCareer],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    }),
    create: jest.fn().mockResolvedValue(mockCareer),
    update: jest.fn().mockResolvedValue({ ...mockCareer, name: 'Tech V2' }),
    softDelete: jest.fn().mockResolvedValue({ ...mockCareer, isActive: false }),
  };

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CareerController],
      providers: [
        Reflector,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CareerService,
          useValue: mockCareerService,
        },
      ],
    }).compile();

    controller = module.get<CareerController>(CareerController);
    service = module.get<CareerService>(CareerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('should return paginated careers', async () => {
      const result = await controller.getAll('1', '10');
      expect(result.success).toBe(true);
      expect(result.data.items).toEqual([mockCareer]);
      expect(service.findAll).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('create', () => {
    it('should create a career', async () => {
      const dto: CreateCareerDto = {
        name: 'Technology',
        slug: 'technology',
        description: 'Tech Career',
        icon: 'code',
        color: '#ff0000',
        sortOrder: 1,
        isActive: true,
      };
      const result = await controller.create(dto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCareer);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should update a career', async () => {
      const dto: UpdateCareerDto = { name: 'Tech V2' };
      const result = await controller.update('career-uuid-1', dto);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Tech V2');
      expect(service.update).toHaveBeenCalledWith('career-uuid-1', dto);
    });
  });

  describe('delete', () => {
    it('should soft delete a career', async () => {
      const result = await controller.delete('career-uuid-1');
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(false);
      expect(service.softDelete).toHaveBeenCalledWith('career-uuid-1');
    });
  });
});
