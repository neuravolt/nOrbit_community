import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Regression test: clientLogin() previously had zero brute-force protection, unlike staff
// login (Redis lockout) and student login (DB-field lockout). Verifies the 'client' Redis
// keyspace lockout added this session, independent of the staff 'user' keyspace.
describe('AuthService.clientLogin — account lockout', () => {
  let service: AuthService;
  let mockPrisma: any;
  let redisStore: Map<string, { value: string; expiresAt: number | null }>;

  beforeEach(async () => {
    mockPrisma = {
      clientUser: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: {} },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('token') },
        },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Replace the real ioredis client with an in-memory fake — mirrors the
    // (service as any).redis reassignment pattern used elsewhere in this codebase's tests.
    (service as any).redis.disconnect();
    redisStore = new Map();
    (service as any).redis = {
      get: jest.fn(async (k: string) => {
        const e = redisStore.get(k);
        if (!e) return null;
        if (e.expiresAt && e.expiresAt < Date.now()) {
          redisStore.delete(k);
          return null;
        }
        return e.value;
      }),
      set: jest.fn(async (k: string, v: string, ...args: any[]) => {
        const exIdx = args.indexOf('EX');
        const ttl = exIdx >= 0 ? args[exIdx + 1] * 1000 : null;
        redisStore.set(k, {
          value: v,
          expiresAt: ttl ? Date.now() + ttl : null,
        });
      }),
      del: jest.fn(async (k: string) => {
        redisStore.delete(k);
      }),
      incr: jest.fn(async (k: string) => {
        const e = redisStore.get(k);
        const next = (e ? parseInt(e.value, 10) : 0) + 1;
        redisStore.set(k, {
          value: String(next),
          expiresAt: e?.expiresAt ?? null,
        });
        return next;
      }),
      expire: jest.fn(async (k: string, seconds: number) => {
        const e = redisStore.get(k);
        if (e) e.expiresAt = Date.now() + seconds * 1000;
      }),
      ttl: jest.fn(async (k: string) => {
        const e = redisStore.get(k);
        if (!e || !e.expiresAt) return 900;
        return Math.ceil((e.expiresAt - Date.now()) / 1000);
      }),
    };
  });

  it('locks the account after 5 consecutive failed login attempts', async () => {
    mockPrisma.clientUser.findUnique.mockResolvedValue(null); // "invalid email" path also counts as a failed attempt

    for (let i = 0; i < 5; i++) {
      await expect(
        service.clientLogin({ email: 'client@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    }

    // The 6th attempt should be rejected by the lockout check itself, before any DB lookup
    mockPrisma.clientUser.findUnique.mockClear();
    await expect(
      service.clientLogin({ email: 'client@example.com', password: 'wrong' }),
    ).rejects.toThrow(/locked/i);
    expect(mockPrisma.clientUser.findUnique).not.toHaveBeenCalled();
  });

  it('clears the failed-attempt counter on a successful login', async () => {
    const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
    mockPrisma.clientUser.findUnique.mockResolvedValue({
      id: 'cu-1',
      clientId: 'client-1',
      email: 'client@example.com',
      name: 'Client User',
      passwordHash,
      isActive: true,
      portalEnabled: true,
      firstLogin: false,
    });

    // Two failed attempts first
    mockPrisma.clientUser.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.clientLogin({ email: 'client@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);

    mockPrisma.clientUser.findUnique.mockResolvedValue({
      id: 'cu-1',
      clientId: 'client-1',
      email: 'client@example.com',
      name: 'Client User',
      passwordHash,
      isActive: true,
      portalEnabled: true,
      firstLogin: false,
    });

    const result = await service.clientLogin({
      email: 'client@example.com',
      password: 'CorrectPassword123!',
    });
    expect(result.accessToken).toBeDefined();
    expect(redisStore.has('fails:client:client@example.com')).toBe(false);
  });

  it('a lockout on the client keyspace does not affect the staff login keyspace', async () => {
    mockPrisma.clientUser.findUnique.mockResolvedValue(null);
    for (let i = 0; i < 5; i++) {
      await expect(
        service.clientLogin({ email: 'shared@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    }
    expect(redisStore.has('lock:client:shared@example.com')).toBe(true);
    expect(redisStore.has('lock:user:shared@example.com')).toBe(false);
  });
});
