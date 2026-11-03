import { Injectable } from '@nestjs/common';
import { PrismaService } from './common/prisma/prisma.service';
import Redis from 'ioredis';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth() {
    let dbStatus = 'UP';
    let redisStatus = 'UP';
    const details: any = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      details.db = 'Database is connected and responsive.';
    } catch (err: any) {
      dbStatus = 'DOWN';
      details.db = `Database error: ${err.message}`;
    }

    try {
      const redis = new Redis(
        process.env.REDIS_URL || 'redis://localhost:6379',
        {
          connectTimeout: 2000,
          maxRetriesPerRequest: 0,
        },
      );
      const ping = await redis.ping();
      redis.disconnect();
      if (ping === 'PONG') {
        details.redis = 'Redis is connected and responsive.';
      } else {
        redisStatus = 'DOWN';
        details.redis = `Redis returned: ${ping}`;
      }
    } catch (err: any) {
      redisStatus = 'DOWN';
      details.redis = `Redis error: ${err.message}`;
    }

    const status =
      dbStatus === 'UP' && redisStatus === 'UP' ? 'UP' : 'DEGRADED';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      details,
    };
  }
}
