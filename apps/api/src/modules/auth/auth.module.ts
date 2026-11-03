import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getJwtSecret } from '@neuravolt/shared-utils';
import { AuthController } from './auth.controller';
import { ClientAuthController } from './client-auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtStrategy } from './jwt.strategy';
import { ClientJwtStrategy } from './client-jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController, ClientAuthController],
  providers: [AuthService, AuthRepository, JwtStrategy, ClientJwtStrategy],
  exports: [AuthService, JwtStrategy, ClientJwtStrategy, PassportModule],
})
export class AuthModule {}
