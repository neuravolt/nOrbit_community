import { createHash } from 'crypto';
import {
  inviteUrl,
  newInvite,
  publicUser,
  rbacRolesFor,
  temporaryPassword,
} from './employee-access.policy';

describe('employee access on onboarding', () => {
  it('gives the job role plus the base employee role', () => {
    expect(rbacRolesFor('DEVELOPER')).toEqual(['DEVELOPER', 'EMPLOYEE']);
    expect(rbacRolesFor('CLIENT')).toEqual(['EMPLOYEE']);
    expect(rbacRolesFor(undefined)).toEqual(['EMPLOYEE']);
  });

  it('makes a different temporary password each time, never a shared default', () => {
    const a = temporaryPassword();
    expect(a).not.toBe(temporaryPassword());
    expect(a).not.toMatch(/VoltNovate/);
    expect(a.length).toBeGreaterThanOrEqual(12);
  });

  it('never sends the password hash to the browser', () => {
    expect(
      publicUser({ id: '1', email: 'a@b', passwordHash: 'x', tokenVersion: 2 }),
    ).toEqual({ id: '1', email: 'a@b' });
  });

  it('makes a one-time invite link and stores only its hash', () => {
    const i = newInvite(0);
    expect(i.tokenHash).toBe(
      createHash('sha256').update(i.token).digest('hex'),
    );
    expect(i.expiresAt.getTime()).toBe(7 * 86_400_000);
    expect(inviteUrl('abc', 'https://teams.x.in/')).toBe(
      'https://teams.x.in/set-password?token=abc',
    );
  });
});
