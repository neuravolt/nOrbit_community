import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './leads.repository';
import { ClientsRepository } from '../clients/clients.repository';
import { LeadsApiKeyGuard } from './guards/leads-api-key.guard';
import { UnauthorizedException } from '@nestjs/common';

describe('Leads Capture & API Key Integration', () => {
  let service: LeadsService;
  let guard: LeadsApiKeyGuard;
  let mockLeadsRepo: Partial<LeadsRepository>;
  let mockClientsRepo: Partial<ClientsRepository>;

  const activeKey = 'nv_lead_live_f8b7e8994670d1513feeb751a09fe2fc';

  beforeEach(async () => {
    process.env.LEADS_CAPTURE_API_KEY = activeKey;

    mockLeadsRepo = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockClientsRepo = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        LeadsApiKeyGuard,
        { provide: LeadsRepository, useValue: mockLeadsRepo },
        { provide: ClientsRepository, useValue: mockClientsRepo },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    guard = module.get<LeadsApiKeyGuard>(LeadsApiKeyGuard);
  });

  describe('API Key Validation', () => {
    it('should validate matching key', () => {
      expect(service.validateApiKey(activeKey)).toBe(true);
    });

    it('should reject invalid key', () => {
      expect(service.validateApiKey('wrong-key')).toBe(false);
      expect(service.validateApiKey('')).toBe(false);
    });

    it('guard should allow request with valid x-api-key', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-api-key': activeKey },
          }),
        }),
      } as any;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('guard should reject request with missing key', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
      } as any;

      expect(() => guard.canActivate(mockContext)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Lead Capture', () => {
    it('should capture a brand new lead', async () => {
      (mockLeadsRepo.findByEmail as jest.Mock).mockResolvedValue(null);
      (mockLeadsRepo.create as jest.Mock).mockResolvedValue({
        id: 'new-lead-uuid-1',
        name: 'Test Customer',
        email: 'customer@ecoprobuilders.in',
        notes:
          '[Source Domain: ecoprobuilders.in]\nInterested in commercial construction',
      });

      const result = await service.captureLead({
        name: 'Test Customer',
        email: 'customer@ecoprobuilders.in',
        phone: '+91 9876543210',
        service: 'Turnkey Construction',
        website: 'ecoprobuilders.in',
        notes: 'Interested in commercial construction',
      });

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(true);
      expect(result.leadId).toBe('new-lead-uuid-1');
      expect(mockLeadsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Customer',
          email: 'customer@ecoprobuilders.in',
          source: 'Website',
          notes: expect.stringContaining('[Service: Turnkey Construction]'),
        }),
      );
    });

    it('should append subsequent inquiry to existing lead without error', async () => {
      (mockLeadsRepo.findByEmail as jest.Mock).mockResolvedValue({
        id: 'existing-lead-uuid-1',
        name: 'Existing Customer',
        email: 'existing@ecoprobuilders.in',
        notes: 'First inquiry from 1 month ago',
      });
      (mockLeadsRepo.update as jest.Mock).mockResolvedValue({
        id: 'existing-lead-uuid-1',
      });

      const result = await service.captureLead({
        name: 'Existing Customer',
        email: 'existing@ecoprobuilders.in',
        phone: '+91 9876543210',
        website: 'ecoprobuilders.in',
        notes: 'Follow up inquiry: Need quotation update',
      });

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(false);
      expect(result.leadId).toBe('existing-lead-uuid-1');
      expect(mockLeadsRepo.update).toHaveBeenCalledWith(
        'existing-lead-uuid-1',
        expect.objectContaining({
          notes: expect.stringContaining('Subsequent Inquiry'),
        }),
      );
    });
  });
});
