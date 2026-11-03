import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from '@neuravolt/shared-utils';
import { PrismaService } from '../../common';

@Injectable()
export class ClientJwtStrategy extends PassportStrategy(
  Strategy,
  'client-jwt',
) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: any) {
    if (!payload.clientId) {
      throw new UnauthorizedException('Invalid client token');
    }

    const clientUser = await this.prisma.clientUser.findUnique({
      where: { id: payload.sub },
      include: { client: true },
    });

    if (
      !clientUser ||
      !clientUser.isActive ||
      !clientUser.portalEnabled ||
      payload.version !== clientUser.tokenVersion
    ) {
      throw new UnauthorizedException(
        'Client portal access is disabled or session expired',
      );
    }

    return {
      id: clientUser.id,
      clientId: clientUser.clientId,
      email: clientUser.email,
      name: clientUser.name,
      firstLogin: clientUser.firstLogin,
    };
  }
}
