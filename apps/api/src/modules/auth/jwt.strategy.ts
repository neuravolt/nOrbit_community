import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from '@neuravolt/shared-utils';
import { PrismaService } from '../../common';
import { isStaffTokenPayload } from './staff-token';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: any) {
    // A student / partner / client token must never authenticate a staff route.
    if (!isStaffTokenPayload(payload)) {
      return null;
    }

    // Fetch fresh user data including role so guards can check it
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        tokenVersion: true,
        userType: true,
        emailVerified: true,
        activeOrganizationId: true,
      },
    });

    if (!user || !user.isActive || payload.version !== user.tokenVersion) {
      return null;
    }

    return user;
  }
}
