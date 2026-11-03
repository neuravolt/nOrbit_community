import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  BadRequestException,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthResponseDto, CurrentUserDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  RegisterCustomerDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SwitchOrgDto,
} from './dto/customer-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: any,
  ): Promise<any> {
    const result = await this.authService.login(loginDto);
    if (result?.requires2FA) {
      // STEALTH MODE: Session token stored in HttpOnly cookie.
      // Response body has ZERO tokens, ZERO emails, ZERO internal messages!
      res.cookie('mfa_ticket', result.mfaSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 300 * 1000, // 5 minutes
        path: '/',
      });
      return { challenge: true, targetEmail: result.targetEmail };
    }
    return result;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-2fa')
  @HttpCode(200)
  async verify2FA(
    @Body() dto: Verify2FADto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ): Promise<AuthResponseDto> {
    // Extract token from HttpOnly cookie, or fallback to body if provided
    const cookieHeader = req.headers.cookie || '';
    const cookieToken = cookieHeader
      .split('; ')
      .find((row: string) => row.startsWith('mfa_ticket='))
      ?.split('=')[1];

    const token = cookieToken || dto.mfaSessionToken;
    if (!token) {
      throw new BadRequestException(
        'Security session not found. Please log in again.',
      );
    }

    const authResponse = await this.authService.verify2FA({
      mfaSessionToken: token,
      otp: dto.otp,
    });

    // Clear the ticket cookie upon successful verification
    res.clearCookie('mfa_ticket', { path: '/' });
    return authResponse;
  }

  // --- Touch ID / WebAuthn Endpoints ---

  @UseGuards(JwtAuthGuard)
  @Get('webauthn/register-options')
  async getWebAuthnRegisterOptions(@CurrentUser() user: CurrentUserDto) {
    return this.authService.getWebAuthnRegisterOptions(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('webauthn/register-verify')
  async verifyWebAuthnRegister(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: any,
  ) {
    return this.authService.verifyWebAuthnRegister(user.id, body);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('webauthn/login-options')
  async getWebAuthnLoginOptions(@Body('email') email: string) {
    if (!email) throw new BadRequestException('Email is required');
    return this.authService.getWebAuthnLoginOptions(email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('webauthn/login-verify')
  async verifyWebAuthnLogin(
    @Body('challengeToken') challengeToken: string,
    @Body('credential') credential: any,
  ) {
    if (!challengeToken || !credential) {
      throw new BadRequestException(
        'challengeToken and credential are required',
      );
    }
    return this.authService.verifyWebAuthnLogin(challengeToken, credential);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async logout(
    @CurrentUser() user: CurrentUserDto,
    @Body('refreshToken') refreshToken?: string,
  ): Promise<void> {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }
    await this.authService.logout(user.id, refreshToken);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body('refreshToken') refreshToken?: string,
  ): Promise<AuthResponseDto> {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }
    return this.authService.refresh(refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(
    @CurrentUser() user: CurrentUserDto,
  ): Promise<CurrentUserDto> {
    return this.authService.getCurrentUser(user.id);
  }

  /** Public: a new employee sets their password from the emailed invite link. */
  @Post('set-password')
  @HttpCode(200)
  async setPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.setPasswordFromInvite(
      body?.token,
      body?.newPassword,
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: CurrentUserDto,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<CurrentUserDto> {
    return this.authService.changePassword(user.id, changePasswordDto);
  }

  // ── CUSTOMER SAAS ENDPOINTS ──────────────────────────────────────────────

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post(['register', 'customer/register'])
  @HttpCode(201)
  async register(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyCustomerEmail(dto.token);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post(['resend-verification', 'customer/resend-verification'])
  @HttpCode(200)
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationEmail(email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotCustomerPassword(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetCustomerPassword(dto.token, dto.newPassword);
  }

  @Post('switch-org')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async switchOrg(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: SwitchOrgDto,
  ) {
    return this.authService.switchOrganization(user.id, dto.organizationId);
  }
}
