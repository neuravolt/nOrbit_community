import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ClientJwtAuthGuard } from './guards/client-jwt-auth.guard';

@Controller('auth/client')
export class ClientAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() loginDto: LoginDto) {
    return this.authService.clientLogin(loginDto);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.clientRefresh(refreshToken);
  }

  @UseGuards(ClientJwtAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    const clientUserId = req.user.id;
    return this.authService.clientChangePassword(clientUserId, dto);
  }

  @UseGuards(ClientJwtAuthGuard)
  @Get('me')
  getMe(@Req() req: any) {
    return req.user;
  }
}
