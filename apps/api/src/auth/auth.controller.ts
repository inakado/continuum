import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthUser } from './auth.types';
import { resolveAuthCookieName, resolveAuthCookieOptions } from './auth.config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

type AuthRequest = Request & { user: AuthUser };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(req.user);
    const cookieName = resolveAuthCookieName();
    const cookieOptions = resolveAuthCookieOptions();
    res.cookie(cookieName, result.accessToken, cookieOptions);
    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    const cookieName = resolveAuthCookieName();
    const cookieOptions = resolveAuthCookieOptions();
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: 0 });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthRequest) {
    return { user: req.user };
  }
}
