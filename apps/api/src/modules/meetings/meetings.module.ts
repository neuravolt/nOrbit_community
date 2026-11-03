import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { getJwtSecret } from '@neuravolt/shared-utils';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [
    PrismaModule,
    // Resolved at DI time (not import time) and via getJwtSecret(), which refuses a missing or
    // short secret — the old inline fallback silently signed meeting tokens with a key that
    // was committed to the repo whenever JWT_SECRET wasn't in the environment yet.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: '5m' },
      }),
    }),
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
