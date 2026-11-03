import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '@neuravolt/shared-config';
import * as crypto from 'crypto';

@Injectable()
export class AdvancedThrottlerGuard implements CanActivate {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(
      AppConfig.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      {
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        enableOfflineQueue: false,
        retryStrategy: (times) => Math.min(times * 100, 2000),
      },
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    let rateKey = '';
    let limitType = 'IP';

    // 1. API Key Check (for B2B clients)
    const apiKey = req.headers['x-api-key'];

    // 2. User / Student ID Check (via decoded JWT sub)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf8'),
          );
          userId = payload.sub;
        }
      } catch {}
    }

    // 3. Auth Token Signature Hash (if token is stolen/abused)
    let tokenHash: string | null = null;
    if (authHeader) {
      tokenHash = crypto.createHash('sha256').update(authHeader).digest('hex');
    }

    // 4. Session ID Check
    const sessionId = req.headers['x-session-id'];

    // 5. Device Fingerprint Check
    const deviceFingerprint = req.headers['x-device-fingerprint'];

    // Progressive Key Selection
    if (apiKey) {
      rateKey = `rate:apikey:${apiKey}`;
      limitType = 'API_KEY';
    } else if (userId) {
      rateKey = `rate:user:${userId}`;
      limitType = 'USER';
    } else if (tokenHash) {
      rateKey = `rate:token:${tokenHash}`;
      limitType = 'TOKEN';
    } else if (sessionId) {
      rateKey = `rate:session:${sessionId}`;
      limitType = 'SESSION';
    } else if (deviceFingerprint) {
      rateKey = `rate:device:${deviceFingerprint}`;
      limitType = 'DEVICE';
    } else {
      rateKey = `rate:ip:${req.ip}`;
      limitType = 'IP';
    }

    // Defensive check: if Redis is unreachable, fail-open to preserve API availability
    try {
      // Check progressive block state in Redis
      const blockKey = `block:${rateKey}`;
      const blockTime = await this.redis.get(blockKey);
      if (blockTime) {
        const retryAfter = Math.ceil(
          (parseInt(blockTime, 10) - Date.now()) / 1000,
        );
        if (retryAfter > 0) {
          res.setHeader('Retry-After', retryAfter);
          res.setHeader('X-RateLimit-Limit-Type', limitType);
          throw new HttpException(
            {
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              message: `Too many requests. Progressive block active due to abuse. Retry after ${retryAfter} seconds.`,
              limitType,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      // Atomic rate counter window (1 minute)
      const windowSeconds = 60;
      const limit = apiKey ? 500 : userId ? 200 : 100;

      const currentRequests = await this.redis.incr(rateKey);
      if (currentRequests === 1) {
        await this.redis.expire(rateKey, windowSeconds);
      }

      if (currentRequests > limit) {
        // Escalating violation penalty
        const violationKey = `violation:${rateKey}`;
        const violations = await this.redis.incr(violationKey);
        await this.redis.expire(violationKey, 3600); // reset violations window after 1hr

        let blockSeconds = 30; // 1st violation
        if (violations === 2)
          blockSeconds = 300; // 2nd violation: 5 mins
        else if (violations >= 3) blockSeconds = 3600; // 3rd+ violation: 1 hour

        const expiresAt = Date.now() + blockSeconds * 1000;
        await this.redis.set(blockKey, expiresAt, 'EX', blockSeconds);

        res.setHeader('Retry-After', blockSeconds);
        res.setHeader('X-RateLimit-Limit-Type', limitType);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Rate limit exceeded. Progressive protection activated. You are temporarily blocked for ${blockSeconds} seconds.`,
            limitType,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, limit - currentRequests),
      );
      res.setHeader('X-RateLimit-Limit-Type', limitType);

      return true;
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      // Fail open if Redis is down/unreachable
      return true;
    }
  }
}
