import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { trackSprayFailure } from './credential-spray';
import { AppConfig } from '@neuravolt/shared-config';
import { getJwtSecret, getJwtRefreshSecret } from '@neuravolt/shared-utils';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthResponseDto, CurrentUserDto } from './dto/auth-response.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { isStaffTokenPayload } from './staff-token';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 10;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly redis: Redis;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {
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

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const maskedLocal =
      local.length <= 2
        ? local[0] + '***'
        : local[0] + '***' + local[local.length - 1];
    return `${maskedLocal}@${domain}`;
  }

  private async completeUserLogin(user: any): Promise<AuthResponseDto> {
    // Update last login timestamp
    await this.authRepository.updateLastLoginAt(user.id);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user.id);

    const { roles, permissions } = await this.getUserRolesAndPermissions(
      user.id,
    );
    // Permissions block for elevated roles
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isTenantManager = user.role === 'MANAGER' && user.userType === 'CUSTOMER';

    if (isSuperAdmin) {
      const allPossiblePerms = [
        'client:read',
        'client:create',
        'client:update',
        'client:delete',
        'project:read',
        'project:create',
        'project:update',
        'project:delete',
        'task:read',
        'task:create',
        'task:update',
        'task:delete',
        'ticket:read',
        'ticket:create',
        'ticket:update',
        'ticket:delete',
        'asset:read',
        'asset:create',
        'asset:update',
        'asset:delete',
        'amc:read',
        'amc:create',
        'amc:update',
        'amc:delete',
        'invoice:read',
        'invoice:create',
        'invoice:update',
        'invoice:delete',
        'quote:read',
        'quote:create',
        'quote:update',
        'quote:delete',
        'accounting:read',
        'accounting:create',
        'accounting:update',
        'accounting:delete',
        'hr:read',
        'hr:create',
        'hr:update',
        'hr:delete',
        'user:read',
        'user:create',
        'user:update',
        'user:delete',
        'role:read',
        'role:create',
        'role:update',
        'role:delete',
      ];
      allPossiblePerms.forEach((p) => {
        if (!permissions.includes(p)) permissions.push(p);
      });
      if (!roles.includes('SUPER_ADMIN')) roles.push('SUPER_ADMIN');
    } else if (isTenantManager) {
      // Tenant workspace owners (SaaS customers with MANAGER role) get full business
      // suite permissions scoped to their organization — but NOT internal admin perms.
      const tenantPerms = [
        'client:read', 'client:create', 'client:update', 'client:delete',
        'project:read', 'project:create', 'project:update', 'project:delete',
        'task:read', 'task:create', 'task:update', 'task:delete',
        'ticket:read', 'ticket:create', 'ticket:update', 'ticket:delete',
        'amc:read', 'amc:create', 'amc:update', 'amc:delete',
        'invoice:read', 'invoice:create', 'invoice:update', 'invoice:delete',
        'quote:read', 'quote:create', 'quote:update', 'quote:delete',
        'accounting:read', 'accounting:create', 'accounting:update', 'accounting:delete',
        'lead:read', 'lead:create', 'lead:update', 'lead:delete',
        'meeting:read', 'meeting:create',
        'guardian:read',
        'report:read',
      ];
      tenantPerms.forEach((p) => {
        if (!permissions.includes(p)) permissions.push(p);
      });
      if (!roles.includes('MANAGER')) roles.push('MANAGER');
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        roles,
        permissions,
        mustChangePassword: !!user.mustChangePassword,
        userType: user.userType || 'STAFF',
        emailVerified: user.emailVerified ?? true,
        activeOrganizationId: user.activeOrganizationId || null,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<any> {
    const { email, password } = loginDto;
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check account lockout state in Redis
    try {
      const lockKey = `lock:user:${normalizedEmail}`;
      const isLocked = await this.redis.get(lockKey);
      if (isLocked) {
        const remainingSeconds = await this.redis.ttl(lockKey);
        const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
        throw new UnauthorizedException(
          `Account locked due to multiple failed login attempts. Please retry after ${remainingMinutes} minute(s).`,
        );
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      // Fail-open if Redis error to prevent outage
    }

    // 2. Find user by email
    const user = await this.authRepository.findUserByEmail(normalizedEmail);
    if (!user) {
      await this.recordFailedAttempt(normalizedEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    // LaunchPad students get a "shadow" User row (same id) so staff-side relations work; it is
    // not a staff account and must not be able to sign in here.
    const isStudentShadow = await this.prisma.launchpadStudent.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (isStudentShadow) {
      await this.recordFailedAttempt(normalizedEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // 4. Verify password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      await this.recordFailedAttempt(normalizedEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Clear failed attempts counter on valid password
    await this.clearFailedAttemptsFor('user', normalizedEmail);

    // Verify email requirement for customer users
    if (user.userType === 'CUSTOMER' && !user.emailVerified) {
      throw new UnauthorizedException(
        'Please verify your email address before logging in. Check your inbox for the verification link.',
      );
    }

    // 5. Check if 2FA is required for this user (e.g. neuravolt@gmail.com or SUPER_ADMIN)
    const requires2FA =
      normalizedEmail === 'neuravolt@gmail.com' ||
      user.role === 'SUPER_ADMIN' ||
      process.env.ENFORCE_2FA === 'true';

    if (requires2FA) {
      // Generate cryptographically secure 6-digit numeric OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto
        .createHash('sha256')
        .update(otp + salt)
        .digest('hex');
      const mfaSessionToken = randomUUID();

      // Store in Redis with strict 5-minute TTL (300 seconds)
      try {
        await this.redis.set(
          `mfa:session:${mfaSessionToken}`,
          JSON.stringify({
            userId: user.id,
            email: user.email,
            hash,
            salt,
            attempts: 0,
          }),
          'EX',
          300,
        );
      } catch (redisErr) {
        this.logger.error('Failed to store 2FA session in Redis', redisErr);
      }

      // Route OTP to ajayprataptomar3@gmail.com for admin accounts
      const dispatchEmail =
        user.email === 'admin@neuravolt.com' ||
        user.email === 'admin@neuravolt.in'
          ? 'ajayprataptomar3@gmail.com'
          : user.email;

      // Enqueue secure email dispatch
      await this.notificationsService.queueEmail(
        dispatchEmail,
        'two_factor_code',
        {
          userName: `${user.firstName || 'User'} ${user.lastName || ''}`.trim(),
          otp,
          expiresInMinutes: 5,
        },
        'Your NeuraVolt Security Verification Code',
      );

      // Return session token and target email for 2FA verification challenge
      return {
        requires2FA: true,
        mfaSessionToken,
        targetEmail: dispatchEmail,
      };
    }

    return this.completeUserLogin(user);
  }

  private async recordFailedAttempt(email: string): Promise<void> {
    return this.recordFailedAttemptFor('user', email);
  }

  // Generalized lockout primitives (keyPrefix separates keyspaces per login surface — staff
  // 'user', client-portal 'client' — so a lockout on one never affects the other) reused by
  // clientLogin() below, which previously had no lockout protection at all.
  private async checkLockoutFor(
    keyPrefix: string,
    identifier: string,
  ): Promise<void> {
    try {
      const lockKey = `lock:${keyPrefix}:${identifier}`;
      const isLocked = await this.redis.get(lockKey);
      if (isLocked) {
        const remainingSeconds = await this.redis.ttl(lockKey);
        const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
        throw new UnauthorizedException(
          `Account locked due to multiple failed login attempts. Please retry after ${remainingMinutes} minute(s).`,
        );
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      // Fail-open if Redis error to prevent outage
    }
  }

  private async recordFailedAttemptFor(
    keyPrefix: string,
    identifier: string,
  ): Promise<void> {
    await trackSprayFailure(this.redis, this.prisma, keyPrefix, identifier);
    try {
      const failKey = `fails:${keyPrefix}:${identifier}`;
      const fails = await this.redis.incr(failKey);
      if (fails === 1) {
        await this.redis.expire(failKey, 900); // 15 mins
      }
      if (fails >= 5) {
        const lockKey = `lock:${keyPrefix}:${identifier}`;
        await this.redis.set(lockKey, 'locked', 'EX', 900); // Lock for 15 mins
        await this.redis.del(failKey);
        throw new UnauthorizedException(
          'Account locked for 15 minutes due to 5 consecutive failed login attempts.',
        );
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
    }
  }

  private async clearFailedAttemptsFor(
    keyPrefix: string,
    identifier: string,
  ): Promise<void> {
    try {
      await this.redis.del(`fails:${keyPrefix}:${identifier}`);
    } catch {}
  }

  async verify2FA(dto: Verify2FADto): Promise<AuthResponseDto> {
    const { mfaSessionToken, otp } = dto;
    const sessionKey = `mfa:session:${mfaSessionToken}`;

    const rawSession = await this.redis.get(sessionKey);
    if (!rawSession) {
      throw new UnauthorizedException(
        'Invalid or expired 2FA session. Please log in again.',
      );
    }

    const session = JSON.parse(rawSession);
    session.attempts = (session.attempts || 0) + 1;

    // Strict Anti-Brute-Force: Max 3 attempts, then destroy session
    if (session.attempts > 3) {
      await this.redis.del(sessionKey);
      throw new UnauthorizedException(
        'Too many invalid OTP attempts. Security session destroyed. Please log in again.',
      );
    }

    const computedHash = crypto
      .createHash('sha256')
      .update(otp + session.salt)
      .digest('hex');

    if (computedHash !== session.hash) {
      // Update attempts counter in Redis
      await this.redis.set(sessionKey, JSON.stringify(session), 'EX', 300);
      const remainingAttempts = 3 - session.attempts;
      throw new UnauthorizedException(
        `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
      );
    }

    // SUCCESS: Burn OTP immediately (Single-Use Guarantee)
    await this.redis.del(sessionKey);

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is invalid or inactive');
    }

    return this.completeUserLogin(user);
  }

  // --- WebAuthn / Touch ID Authentication ---

  private getWebAuthnRPID(): string {
    if (process.env.RP_ID) return process.env.RP_ID;
    return process.env.NODE_ENV === 'production'
      ? 'teams.neuravolt.in'
      : 'localhost';
  }

  private getWebAuthnOrigins(): string[] {
    const list = [
      'https://teams.neuravolt.in',
      'http://localhost:3000',
      'http://localhost:3003',
    ];
    if (process.env.FRONTEND_URL && !list.includes(process.env.FRONTEND_URL)) {
      list.push(process.env.FRONTEND_URL);
    }
    return list;
  }

  async getWebAuthnRegisterOptions(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const rpName = 'NeuraVolt nORBIT';
    const rpID = this.getWebAuthnRPID();

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: `${user.firstName} ${user.lastName}`,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Enforces Touch ID / Face ID / Windows Hello
        userVerification: 'preferred',
      },
    });

    // Save challenge in Redis (5 min TTL)
    await this.redis.set(
      `webauthn:reg_challenge:${user.id}`,
      options.challenge,
      'EX',
      300,
    );
    return options;
  }

  async verifyWebAuthnRegister(userId: string, body: any): Promise<any> {
    const expectedChallenge = await this.redis.get(
      `webauthn:reg_challenge:${userId}`,
    );
    if (!expectedChallenge) {
      throw new BadRequestException('WebAuthn registration challenge expired');
    }

    const rpID = this.getWebAuthnRPID();
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: this.getWebAuthnOrigins(),
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Touch ID verification failed');
    }

    const { credential } = verification.registrationInfo;
    const credData = {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      transports: credential.transports,
    };

    // Store credential in Redis list for this user
    await this.redis.sadd(`webauthn:creds:${userId}`, JSON.stringify(credData));
    await this.redis.del(`webauthn:reg_challenge:${userId}`);

    return {
      verified: true,
      message: 'Touch ID / Passkey enrolled successfully!',
    };
  }

  async getWebAuthnLoginOptions(email: string): Promise<any> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.authRepository.findUserByEmail(normalizedEmail);
    if (!user) throw new UnauthorizedException('Invalid email');

    const credsRaw = await this.redis.smembers(`webauthn:creds:${user.id}`);
    if (!credsRaw || credsRaw.length === 0) {
      throw new BadRequestException(
        'No Passkey / Touch ID enrolled on this device yet. Please sign in with your email and password first.',
      );
    }

    const allowCredentials = credsRaw.map((raw) => {
      const c = JSON.parse(raw);
      return {
        id: c.id,
        type: 'public-key' as const,
        transports: c.transports,
      };
    });

    const rpID = this.getWebAuthnRPID();
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    const challengeToken = randomUUID();
    await this.redis.set(
      `webauthn:auth_challenge:${challengeToken}`,
      JSON.stringify({ challenge: options.challenge, userId: user.id }),
      'EX',
      300,
    );

    return { options, challengeToken };
  }

  async verifyWebAuthnLogin(
    challengeToken: string,
    body: any,
  ): Promise<AuthResponseDto> {
    const raw = await this.redis.get(
      `webauthn:auth_challenge:${challengeToken}`,
    );
    if (!raw)
      throw new UnauthorizedException(
        'Passkey challenge expired. Please retry.',
      );

    const { challenge: expectedChallenge, userId } = JSON.parse(raw);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const credsRaw = await this.redis.smembers(`webauthn:creds:${user.id}`);
    const matchedCredRaw = credsRaw.find((c) => JSON.parse(c).id === body.id);
    if (!matchedCredRaw) {
      throw new UnauthorizedException(
        'Unrecognized Touch ID / Passkey credential',
      );
    }

    const matchedCred = JSON.parse(matchedCredRaw);
    const rpID = this.getWebAuthnRPID();

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: this.getWebAuthnOrigins(),
      expectedRPID: rpID,
      credential: {
        id: matchedCred.id,
        publicKey: Buffer.from(matchedCred.publicKey, 'base64'),
        counter: matchedCred.counter,
      },
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Touch ID verification failed');
    }

    // Burn challenge token immediately
    await this.redis.del(`webauthn:auth_challenge:${challengeToken}`);

    // Update counter
    matchedCred.counter = verification.authenticationInfo.newCounter;
    await this.redis.srem(`webauthn:creds:${user.id}`, matchedCredRaw);
    await this.redis.sadd(
      `webauthn:creds:${user.id}`,
      JSON.stringify(matchedCred),
    );

    return this.completeUserLogin(user);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken, userId },
      data: { isRevoked: true },
    });
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const dbToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!dbToken || dbToken.isRevoked || dbToken.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Refresh token is invalid or has been revoked',
      );
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: getJwtRefreshSecret(),
      });
      if (!isStaffTokenPayload(payload)) {
        throw new UnauthorizedException(
          'Refresh token is invalid or has been revoked',
        );
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive || payload.version !== user.tokenVersion) {
        throw new UnauthorizedException(
          'User not found, inactive, or session expired',
        );
      }

      await this.prisma.refreshToken.update({
        where: { id: dbToken.id },
        data: { isRevoked: true },
      });

      const { accessToken, refreshToken: newRefreshToken } =
        await this.generateTokens(user.id, user.tokenVersion);

      const { roles, permissions } = await this.getUserRolesAndPermissions(
        user.id,
      );
      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      const isTenantManager = user.role === 'MANAGER' && user.userType === 'CUSTOMER';

      if (isSuperAdmin) {
        const allPossiblePerms = [
          'client:read',
          'client:create',
          'client:update',
          'client:delete',
          'project:read',
          'project:create',
          'project:update',
          'project:delete',
          'task:read',
          'task:create',
          'task:update',
          'task:delete',
          'ticket:read',
          'ticket:create',
          'ticket:update',
          'ticket:delete',
          'asset:read',
          'asset:create',
          'asset:update',
          'asset:delete',
          'amc:read',
          'amc:create',
          'amc:update',
          'amc:delete',
          'invoice:read',
          'invoice:create',
          'invoice:update',
          'invoice:delete',
          'quote:read',
          'quote:create',
          'quote:update',
          'quote:delete',
          'accounting:read',
          'accounting:create',
          'accounting:update',
          'accounting:delete',
          'hr:read',
          'hr:create',
          'hr:update',
          'hr:delete',
          'user:read',
          'user:create',
          'user:update',
          'user:delete',
          'role:read',
          'role:create',
          'role:update',
          'role:delete',
        ];
        allPossiblePerms.forEach((p) => {
          if (!permissions.includes(p)) permissions.push(p);
        });
        if (!roles.includes('SUPER_ADMIN')) roles.push('SUPER_ADMIN');
      } else if (isTenantManager) {
        // Tenant workspace owners: full business suite, no internal-admin perms
        const tenantPerms = [
          'client:read', 'client:create', 'client:update', 'client:delete',
          'project:read', 'project:create', 'project:update', 'project:delete',
          'task:read', 'task:create', 'task:update', 'task:delete',
          'ticket:read', 'ticket:create', 'ticket:update', 'ticket:delete',
          'amc:read', 'amc:create', 'amc:update', 'amc:delete',
          'invoice:read', 'invoice:create', 'invoice:update', 'invoice:delete',
          'quote:read', 'quote:create', 'quote:update', 'quote:delete',
          'accounting:read', 'accounting:create', 'accounting:update', 'accounting:delete',
          'lead:read', 'lead:create', 'lead:update', 'lead:delete',
          'meeting:read', 'meeting:create',
          'guardian:read',
          'report:read',
        ];
        tenantPerms.forEach((p) => {
          if (!permissions.includes(p)) permissions.push(p);
        });
        if (!roles.includes('MANAGER')) roles.push('MANAGER');
      }

      return {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          roles,
          permissions,
        },
      };
    } catch (error) {
      // Real cause, logged rather than swallowed — this catch previously turned every distinct
      // failure (a genuine bad/expired token, but also any unrelated runtime error anywhere in
      // this whole method) into the identical generic "Invalid refresh token", which made a real
      // bug here indistinguishable from a legitimately expired session.
      this.logger.error(
        `refresh() failed: ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<CurrentUserDto> {
    const { oldPassword, newPassword } = changePasswordDto;

    // Fetch user with password hash
    const user = await this.authRepository.findUserByEmail(
      (await this.authRepository.findUserById(userId))!.email,
    );

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify old password
    const passwordMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Ensure new password is different
    const newPasswordMatches = await bcrypt.compare(
      newPassword,
      user.passwordHash,
    );
    if (newPasswordMatches) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    // Update password and increment token version
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
        mustChangePassword: false,
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });

    // Revoke all existing refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
    };
  }

  async getCurrentUser(userId: string): Promise<CurrentUserDto> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { roles, permissions } = await this.getUserRolesAndPermissions(
      user.id,
    );
    // Permissions block for elevated roles
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isTenantManager = user.role === 'MANAGER' && user.userType === 'CUSTOMER';

    if (isSuperAdmin) {
      const allPossiblePerms = [
        'client:read',
        'client:create',
        'client:update',
        'client:delete',
        'project:read',
        'project:create',
        'project:update',
        'project:delete',
        'task:read',
        'task:create',
        'task:update',
        'task:delete',
        'ticket:read',
        'ticket:create',
        'ticket:update',
        'ticket:delete',
        'asset:read',
        'asset:create',
        'asset:update',
        'asset:delete',
        'amc:read',
        'amc:create',
        'amc:update',
        'amc:delete',
        'invoice:read',
        'invoice:create',
        'invoice:update',
        'invoice:delete',
        'quote:read',
        'quote:create',
        'quote:update',
        'quote:delete',
        'accounting:read',
        'accounting:create',
        'accounting:update',
        'accounting:delete',
        'hr:read',
        'hr:create',
        'hr:update',
        'hr:delete',
        'user:read',
        'user:create',
        'user:update',
        'user:delete',
        'role:read',
        'role:create',
        'role:update',
        'role:delete',
      ];
      allPossiblePerms.forEach((p) => {
        if (!permissions.includes(p)) permissions.push(p);
      });
      if (!roles.includes('SUPER_ADMIN')) roles.push('SUPER_ADMIN');
    } else if (isTenantManager) {
      // Tenant workspace owners (SaaS customers with MANAGER role) get full business
      // suite permissions scoped to their organization — but NOT internal admin perms.
      const tenantPerms = [
        'client:read', 'client:create', 'client:update', 'client:delete',
        'project:read', 'project:create', 'project:update', 'project:delete',
        'task:read', 'task:create', 'task:update', 'task:delete',
        'ticket:read', 'ticket:create', 'ticket:update', 'ticket:delete',
        'amc:read', 'amc:create', 'amc:update', 'amc:delete',
        'invoice:read', 'invoice:create', 'invoice:update', 'invoice:delete',
        'quote:read', 'quote:create', 'quote:update', 'quote:delete',
        'accounting:read', 'accounting:create', 'accounting:update', 'accounting:delete',
        'lead:read', 'lead:create', 'lead:update', 'lead:delete',
        'meeting:read', 'meeting:create',
        'guardian:read',
        'report:read',
      ];
      tenantPerms.forEach((p) => {
        if (!permissions.includes(p)) permissions.push(p);
      });
      if (!roles.includes('MANAGER')) roles.push('MANAGER');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      roles,
      permissions,
      mustChangePassword: !!(user as any).mustChangePassword,
      userType: (user as any).userType || 'STAFF',
      activeOrganizationId: (user as any).activeOrganizationId || null,
    };
  }

  /**
   * A new employee sets their own password from the invite link HR's system emailed them. The link
   * works once and expires; using it also ends the "change your one-time password" requirement.
   */
  async setPasswordFromInvite(
    token: string,
    newPassword: string,
  ): Promise<{ email: string }> {
    if (!token || typeof token !== 'string' || token.length < 32)
      throw new BadRequestException('This link is not valid.');
    if (!newPassword || newPassword.length < 8)
      throw new BadRequestException(
        'Choose a password of at least 8 characters.',
      );
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { inviteTokenHash: hash, deletedAt: null },
      select: { id: true, email: true, inviteExpiresAt: true },
    });
    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      throw new BadRequestException(
        'This link has expired or was already used. Ask HR to send a new one.',
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS),
        mustChangePassword: false,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    });
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    return { email: user.email };
  }

  private async getUserRolesAndPermissions(userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const rolesList = userRoles.map((ur) => ur.role.name.toUpperCase());
    const permissionsList = new Set<string>();

    userRoles.forEach((ur) => {
      ur.role.permissions.forEach((rp) => {
        const basePermission = `${rp.permission.resource}:${rp.permission.action}`;
        permissionsList.add(basePermission.toLowerCase());
      });
    });

    return {
      roles: rolesList,
      permissions: Array.from(permissionsList),
    };
  }

  private async generateTokens(
    userId: string,
    tokenVersion?: number,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let version = tokenVersion;
    if (version === undefined) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { tokenVersion: true },
      });
      version = user?.tokenVersion ?? 1;
    }

    // Bug fix: a payload of just {sub, version} with no unique claim signs to the exact same
    // JWT string whenever two tokens are issued for the same user within the same iat second
    // (a real, reproducible collision — e.g. two near-simultaneous refresh calls, or rapid
    // repeated logins). refreshToken has a DB unique constraint on its raw token string, so a
    // collision made refreshToken.create() throw, which the outer catch in refresh() then
    // reported as a generic "Invalid refresh token" — silently logging the user out on what was
    // actually a duplicate-token bug, not an expired/invalid session. jti (a standard JWT claim
    // for exactly this purpose) makes every signed token unique regardless of timing.
    const payload = { sub: userId, version, jti: randomUUID() };

    const accessToken = this.jwtService.sign(payload, {
      secret: getJwtSecret(),
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: getJwtRefreshSecret(),
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    });

    // Save refresh token to database
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken };
  }

  async generateClientTokens(
    clientUserId: string,
    clientId: string,
    tokenVersion?: number,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let version = tokenVersion;
    if (version === undefined) {
      const clientUser = await this.prisma.clientUser.findUnique({
        where: { id: clientUserId },
        select: { tokenVersion: true },
      });
      version = clientUser?.tokenVersion ?? 1;
    }

    // Same collision fix as generateTokens() above — jti guarantees uniqueness even when two
    // tokens are issued for the same client user within the same iat second.
    const payload = { sub: clientUserId, clientId, version, jti: randomUUID() };

    const accessToken = this.jwtService.sign(payload, {
      secret: getJwtSecret(),
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: getJwtRefreshSecret(),
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    });

    // Save refresh token to database
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        clientId: clientUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken };
  }

  async clientLogin(loginDto: LoginDto): Promise<any> {
    const { email, password } = loginDto;
    const normalizedEmail = email.trim().toLowerCase();

    await this.checkLockoutFor('client', normalizedEmail);

    const clientUser = await this.prisma.clientUser.findUnique({
      where: { email },
      include: { client: true },
    });
    if (!clientUser) {
      await this.recordFailedAttemptFor('client', normalizedEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!clientUser.isActive || !clientUser.portalEnabled) {
      throw new UnauthorizedException('Client portal access is disabled');
    }

    const passwordMatch = await bcrypt.compare(
      password,
      clientUser.passwordHash,
    );
    if (!passwordMatch) {
      await this.recordFailedAttemptFor('client', normalizedEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.clearFailedAttemptsFor('client', normalizedEmail);

    await this.prisma.clientUser.update({
      where: { id: clientUser.id },
      data: { lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = await this.generateClientTokens(
      clientUser.id,
      clientUser.clientId,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: clientUser.id,
        clientId: clientUser.clientId,
        email: clientUser.email,
        name: clientUser.name,
        firstLogin: clientUser.firstLogin,
      },
    };
  }

  async clientRefresh(refreshToken: string): Promise<any> {
    const dbToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!dbToken || dbToken.isRevoked || dbToken.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Refresh token is invalid or has been revoked',
      );
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: getJwtRefreshSecret(),
      });

      const clientUser = await this.prisma.clientUser.findUnique({
        where: { id: payload.sub },
      });
      if (
        !clientUser ||
        !clientUser.isActive ||
        !clientUser.portalEnabled ||
        payload.version !== clientUser.tokenVersion
      ) {
        throw new UnauthorizedException(
          'User not found, inactive, or session expired',
        );
      }

      await this.prisma.refreshToken.update({
        where: { id: dbToken.id },
        data: { isRevoked: true },
      });

      const { accessToken, refreshToken: newRefreshToken } =
        await this.generateClientTokens(
          clientUser.id,
          clientUser.clientId,
          clientUser.tokenVersion,
        );

      return {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: clientUser.id,
          clientId: clientUser.clientId,
          email: clientUser.email,
          name: clientUser.name,
          firstLogin: clientUser.firstLogin,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async clientChangePassword(
    clientUserId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<any> {
    const { oldPassword, newPassword } = changePasswordDto;

    const clientUser = await this.prisma.clientUser.findUnique({
      where: { id: clientUserId },
    });

    if (!clientUser) {
      throw new UnauthorizedException('Client user not found');
    }

    const passwordMatch = await bcrypt.compare(
      oldPassword,
      clientUser.passwordHash,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordMatches = await bcrypt.compare(
      newPassword,
      clientUser.passwordHash,
    );
    if (newPasswordMatches) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const newPasswordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    const updated = await this.prisma.clientUser.update({
      where: { id: clientUserId },
      data: {
        passwordHash: newPasswordHash,
        firstLogin: false,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    });

    // Revoke all existing client user refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { clientId: clientUserId },
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
    };
  }

  // ── CUSTOMER SAAS AUTHENTICATION & ONBOARDING ────────────────────────────

  async registerCustomer(dto: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName?: string;
  }) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check existing account
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException(
        'An account with this email address already exists.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    // Cryptographic token for email verification
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user as a tenant Workspace Owner (CUSTOMER type, MANAGER role).
    // IMPORTANT: Tenant SaaS signups MUST NOT get SUPER_ADMIN or STAFF — that
    // would grant cross-tenant access to all internal NeuraVolt data.
    // MANAGER role gives full business-suite access scoped to their org.
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        userType: 'CUSTOMER',
        emailVerified: false,
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
        role: 'MANAGER',
      },
    });

    // If an initial organization name was provided, create it now
    if (dto.organizationName && dto.organizationName.trim()) {
      const org = await this.prisma.organization.create({
        data: {
          name: dto.organizationName.trim(),
          members: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });

      await this.prisma.user.update({
        where: { id: user.id },
        data: { activeOrganizationId: org.id },
      });
    }

    // Dispatch verification email
    const verificationUrl = `https://norbit.neuravolt.in/verify-email?token=${rawToken}`;
    try {
      await this.notificationsService.queueEmail(
        user.email,
        'email_verification',
        {
          userName: `${user.firstName} ${user.lastName}`.trim(),
          verificationUrl,
          rawToken,
        },
        'Verify your NORBIT workspace account',
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to queue verification email for ${user.email}: ${err.message}`,
      );
    }

    return {
      success: true,
      message:
        'Registration successful. Please check your email to verify your account.',
      email: user.email,
      verificationToken:
        process.env.NODE_ENV !== 'production' ? rawToken : undefined,
    };
  }

  async verifyCustomerEmail(token: string) {
    if (!token || !token.trim()) {
      throw new BadRequestException('Verification token is required');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(token.trim())
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Invalid or expired email verification token.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
      },
    });

    return {
      success: true,
      message: 'Email verified successfully. You can now sign in to NORBIT.',
    };
  }

  async resendVerificationEmail(email: string) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email address is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.emailVerified) {
      // Return success without revealing account existence
      return {
        success: true,
        message: 'If an unverified account exists, a new verification link has been dispatched.',
      };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    const verificationUrl = `https://norbit.neuravolt.in/verify-email?token=${rawToken}`;
    try {
      await this.notificationsService.queueEmail(
        user.email,
        'email_verification',
        {
          userName: `${user.firstName} ${user.lastName}`.trim(),
          verificationUrl,
          rawToken,
        },
        'Verify your NORBIT workspace account',
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to queue resend verification email for ${user.email}: ${err.message}`,
      );
    }

    return {
      success: true,
      message: 'A fresh verification link has been dispatched to your email address.',
    };
  }

  async forgotCustomerPassword(email: string) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user && user.isActive) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      });

      const resetUrl = `https://norbit.neuravolt.in/reset-password?token=${rawToken}`;
      try {
        await this.notificationsService.queueEmail(
          user.email,
          'password_reset',
          {
            userName: `${user.firstName} ${user.lastName}`.trim(),
            resetUrl,
            rawToken,
          },
          'Reset your NORBIT account password',
        );
      } catch (err: any) {
        this.logger.warn(
          `Failed to queue password reset email: ${err.message}`,
        );
      }
    }

    // Always return success to prevent user email enumeration
    return {
      success: true,
      message:
        'If an account exists with this email, a password reset link has been dispatched.',
    };
  }

  async resetCustomerPassword(token: string, newPassword: string) {
    if (!token || !token.trim()) {
      throw new BadRequestException('Reset token is required');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        'New password must be at least 8 characters long',
      );
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(token.trim())
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    });

    return {
      success: true,
      message: 'Password reset successfully. You may now sign in.',
    };
  }

  async switchOrganization(userId: string, targetOrganizationId: string) {
    if (!targetOrganizationId) {
      throw new BadRequestException('organizationId is required');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: targetOrganizationId,
          userId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new UnauthorizedException(
        'You are not a member of the requested organization.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { activeOrganizationId: targetOrganizationId },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const tokens = await this.generateTokens(userId, user?.tokenVersion);

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeOrganizationId: targetOrganizationId,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        role: membership.role,
      },
      tokens,
      user: {
        id: user!.id,
        email: user!.email,
        firstName: user!.firstName,
        lastName: user!.lastName,
        role: user!.role,
        userType: user!.userType,
        emailVerified: user!.emailVerified,
        activeOrganizationId: targetOrganizationId,
      },
    };
  }
}
