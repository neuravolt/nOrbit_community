import { createHash, randomBytes, randomInt } from 'crypto';

/** Roles that are managed automatically from an employee's role field (custom roles are left alone). */
export const AUTO_ROLE_NAMES = [
  'MANAGER',
  'DEVELOPER',
  'QA',
  'SALES',
  'SUPPORT',
  'ACCOUNTANT',
  'EMPLOYEE',
];

/** The permission roles an employee with this role gets: their job role plus the base employee role. */
export function rbacRolesFor(role: string | null | undefined): string[] {
  return [
    ...new Set(
      [role, 'EMPLOYEE'].filter(
        (r): r is string => !!r && AUTO_ROLE_NAMES.includes(r),
      ),
    ),
  ];
}

/** A one-off first password, different for every employee (no shared default anyone can guess). */
export function temporaryPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[randomInt(chars.length)];
  return `${out}#${randomInt(10, 99)}`;
}

/** A user record safe to send to the browser: never the password hash or the session version. */
export function publicUser<T extends Record<string, any>>(
  user: T,
): Omit<T, 'passwordHash' | 'tokenVersion'> {
  const { passwordHash: _h, tokenVersion: _v, ...rest } = user;
  return rest;
}

export const INVITE_VALID_DAYS = 7;

/** A one-time "set your password" link: the token goes in the email, only its hash is stored. */
export function newInvite(now = Date.now()): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(now + INVITE_VALID_DAYS * 86_400_000),
  };
}

export function inviteUrl(
  token: string,
  base = process.env.FRONTEND_URL || 'https://teams.neuravolt.in',
): string {
  return `${base.replace(/\/+$/, '')}/set-password?token=${token}`;
}
