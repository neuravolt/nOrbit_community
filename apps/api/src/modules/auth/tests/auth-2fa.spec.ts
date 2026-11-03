import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService - Zero-Leak 2FA & Account Lockout', () => {
  let service: AuthService;
  let mockAuthRepo: any;
  let mockJwtService: any;
  let mockPrisma: any;
  let mockNotificationsService: any;

  beforeEach(async () => {
    mockAuthRepo = {
      findUserByEmail: jest.fn(),
      updateLastLoginAt: jest.fn(),
    };
    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };
    mockPrisma = {
      refreshToken: { create: jest.fn() },
      user: { findUnique: jest.fn() },
      launchpadStudent: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    mockNotificationsService = {
      queueEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('rejects a LaunchPad student shadow User at the staff login, even with the right password', async () => {
    const passwordHash = await bcrypt.hash('StudentPass123!', 10);
    mockAuthRepo.findUserByEmail.mockResolvedValue({
      id: 'student-uuid',
      email: 'stu@example.com',
      passwordHash,
      isActive: true,
      role: 'CLIENT',
      firstName: 'Stu',
      lastName: 'Dent',
    });
    mockPrisma.launchpadStudent.findUnique.mockResolvedValue({
      id: 'student-uuid',
    });

    await expect(
      service.login({ email: 'stu@example.com', password: 'StudentPass123!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mockJwtService.sign).not.toHaveBeenCalled();
  });

  it('should return opaque 2FA challenge and send email for neuravolt@gmail.com without leaking OTP in response', async () => {
    const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
    mockAuthRepo.findUserByEmail.mockResolvedValue({
      id: 'admin-uuid',
      email: 'neuravolt@gmail.com',
      passwordHash,
      isActive: true,
      role: 'SUPER_ADMIN',
      firstName: 'NeuraVolt',
      lastName: 'Admin',
    });

    const result = await service.login({
      email: 'neuravolt@gmail.com',
      password: 'CorrectPassword123!',
    });

    // 1. Must flag requires2FA
    expect(result.requires2FA).toBe(true);

    // 2. Must NOT leak OTP or email in the response object
    expect(result.otp).toBeUndefined();
    expect(result.emailMasked).toBeUndefined();
    expect(result.message).toBeUndefined();

    // 3. Must have queued the email notification with OTP
    expect(mockNotificationsService.queueEmail).toHaveBeenCalledWith(
      'neuravolt@gmail.com',
      'two_factor_code',
      expect.objectContaining({
        userName: 'NeuraVolt Admin',
        otp: expect.stringMatching(/^\d{6}$/),
      }),
      expect.any(String),
    );
  });
});
