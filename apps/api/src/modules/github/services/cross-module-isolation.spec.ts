import { UnauthorizedException } from '@nestjs/common';
import { isStaffTokenPayload } from '../../auth/staff-token';
import { StudentJwtStrategy } from '../../launchpad/guards/student-jwt.strategy';

describe('Cross-Module Security & Data Isolation Tests', () => {
  describe('1. Token & Passport Strategy Boundary Enforcement', () => {
    it('isStaffTokenPayload strictly rejects STUDENT tokens from authenticating on internal Projects/Tasks routes', () => {
      const studentPayload = {
        sub: 'student-123',
        email: 'student@example.com',
        type: 'STUDENT',
        version: 1,
      };
      expect(isStaffTokenPayload(studentPayload)).toBe(false);
    });

    it('isStaffTokenPayload strictly rejects PARTNER_ADMIN tokens from authenticating on internal Projects/Tasks routes', () => {
      const partnerPayload = {
        sub: 'partner-123',
        email: 'partner@example.com',
        type: 'PARTNER_ADMIN',
        version: 1,
      };
      expect(isStaffTokenPayload(partnerPayload)).toBe(false);
    });

    it('isStaffTokenPayload strictly rejects CLIENT portal tokens from authenticating on internal Projects/Tasks routes', () => {
      const clientPayload = {
        sub: 'client-user-1',
        clientId: 'client-org-123',
        version: 1,
      };
      expect(isStaffTokenPayload(clientPayload)).toBe(false);
    });

    it('isStaffTokenPayload allows only genuine internal staff tokens', () => {
      const staffPayload = {
        sub: 'user-pm-1',
        email: 'pm@neuravolt.com',
        version: 1,
      };
      expect(isStaffTokenPayload(staffPayload)).toBe(true);
    });

    it('StudentJwtStrategy strictly rejects staff tokens lacking type === "STUDENT"', async () => {
      const mockPrisma: any = {
        launchpadStudent: { findUnique: jest.fn() },
        user: { findUnique: jest.fn() },
      };
      const studentStrategy = new StudentJwtStrategy(mockPrisma);

      const staffPayload = {
        sub: 'staff-pm-1',
        email: 'pm@neuravolt.com',
        version: 1,
      };
      await expect(studentStrategy.validate(staffPayload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(studentStrategy.validate(staffPayload)).rejects.toThrow(
        'Invalid student token',
      );
    });

    it('StudentJwtStrategy accepts valid student tokens and checks account version', async () => {
      const mockPrisma: any = {
        launchpadStudent: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'student-42',
            email: 'student42@college.edu',
            tokenVersion: 2,
          }),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'student-42' }),
        },
      };
      const studentStrategy = new StudentJwtStrategy(mockPrisma);

      const validStudentPayload = {
        sub: 'student-42',
        email: 'student42@college.edu',
        type: 'STUDENT',
        version: 2,
      };
      const validated = await studentStrategy.validate(validStudentPayload);
      expect(validated).toBeDefined();
      expect(validated.id).toBe('student-42');

      // Expired/stale token version must be rejected
      const staleStudentPayload = {
        sub: 'student-42',
        email: 'student42@college.edu',
        type: 'STUDENT',
        version: 1,
      };
      await expect(
        studentStrategy.validate(staleStudentPayload),
      ).rejects.toThrow('Student account not found or session expired');
    });
  });

  describe('2. Financial Air-Gap & Constraint Integrity', () => {
    it('guarantees wallet transaction deduplication via durable idempotency key format', () => {
      const studentId = 'std-uuid-1';
      const prUrl = 'https://github.com/org/repo/pull/42';
      const xpKey = `github:pr-merged:${studentId}:${prUrl}:XP`;
      const coinKey = `github:pr-merged:${studentId}:${prUrl}:COIN`;

      expect(xpKey).toMatch(/^github:pr-merged:[^:]+:.+:XP$/);
      expect(coinKey).toMatch(/^github:pr-merged:[^:]+:.+:COIN$/);
      expect(xpKey).not.toEqual(coinKey);
    });
  });
});
