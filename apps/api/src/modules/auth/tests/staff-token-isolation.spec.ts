import { isStaffTokenPayload } from '../staff-token';
import { JwtStrategy } from '../jwt.strategy';

describe('staff token isolation', () => {
  it('only payloads without type/clientId are staff tokens', () => {
    expect(isStaffTokenPayload({ sub: 'u', version: 1 })).toBe(true);
    expect(isStaffTokenPayload({ sub: 's', version: 1, type: 'STUDENT' })).toBe(
      false,
    );
    expect(
      isStaffTokenPayload({ sub: 'p', version: 1, type: 'PARTNER_ADMIN' }),
    ).toBe(false);
    expect(isStaffTokenPayload({ sub: 'c', version: 1, clientId: 'x' })).toBe(
      false,
    );
    expect(isStaffTokenPayload(null)).toBe(false);
  });

  it('JwtStrategy rejects a student token even when a same-id shadow User exists', async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'test-secret-that-is-long-enough';
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 's1',
          isActive: true,
          tokenVersion: 1,
          role: 'CLIENT',
        }),
      },
    };
    const strategy = new JwtStrategy(prisma);
    await expect(
      strategy.validate({ sub: 's1', version: 1, type: 'STUDENT' }),
    ).resolves.toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    await expect(
      strategy.validate({ sub: 's1', version: 1 }),
    ).resolves.toMatchObject({ id: 's1' });
  });
});
