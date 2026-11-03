import { Logger } from '@nestjs/common';

/**
 * Guardian plan Phase 4b: credential-stuffing / password-spray detection.
 * Per-account lockout (5 failures) and per-IP throttling (5/min) already exist, but a botnet
 * trying 1-2 passwords on thousands of accounts from thousands of IPs trips neither. This counts
 * DISTINCT accounts with a failed login per 10-minute window (Redis HyperLogLog, a few KB) and
 * alerts SUPER_ADMINs once per hour when that crosses a threshold. It never blocks IPs, so users
 * behind shared/CGNAT addresses are not affected.
 */
export const SPRAY_WINDOW_SECONDS = 600;
export const sprayThreshold = () =>
  Math.max(5, Number(process.env.LOGIN_SPRAY_THRESHOLD) || 30);

const logger = new Logger('CredentialSpray');

export function sprayBucket(now: number): number {
  return Math.floor(now / 1000 / SPRAY_WINDOW_SECONDS);
}

export async function trackSprayFailure(
  redis: {
    pfadd: Function;
    pfcount: Function;
    expire: Function;
    set: Function;
  },
  prisma: any,
  surface: string,
  identifier: string,
  now = Date.now(),
): Promise<boolean> {
  try {
    const key = `spray:${surface}:${sprayBucket(now)}`;
    await redis.pfadd(key, identifier);
    await redis.expire(key, SPRAY_WINDOW_SECONDS * 2);
    const distinct = Number(await redis.pfcount(key));
    if (distinct < sprayThreshold()) return false;
    const hour = Math.floor(now / 3_600_000);
    const first = await redis.set(
      `spray:alerted:${surface}:${hour}`,
      '1',
      'EX',
      3600,
      'NX',
    );
    if (first !== 'OK') return false;
    logger.warn(
      `Possible credential stuffing on ${surface} login: ${distinct} accounts failed in 10 minutes`,
    );
    const admins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', isActive: true },
      select: { id: true },
    });
    for (const a of admins) {
      await prisma.notification.create({
        data: {
          userId: a.id,
          type: 'guardian_credential_stuffing',
          title: `Possible credential-stuffing attack on the ${surface} login`,
          message: `${distinct} different accounts had failed logins in the last 10 minutes. Affected accounts are locked automatically after 5 failures; consider enabling 2FA for all staff.`,
          link: '/guardian/incidents',
        },
      });
    }
    return true;
  } catch {
    return false; // detection must never break login
  }
}
