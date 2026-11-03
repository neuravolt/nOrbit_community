import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { getJwtSecret } from '@neuravolt/shared-utils';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { GuardianDlpService } from './guardian-dlp.service';
import { GuardianModule } from '../guardian/guardian.module';

@Module({
  imports: [
    PrismaModule,
    GuardianModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, GuardianDlpService],
  exports: [ChatService, ChatGateway, GuardianDlpService],
})
export class ChatModule {}
