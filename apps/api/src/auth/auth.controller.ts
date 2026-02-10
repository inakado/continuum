import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthUser } from './auth.types';
import { resolveAuthCookieName, resolveAuthCookieOptions } from './auth.config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

type AuthRequest = Request & { user: AuthUser };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

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
  async me(@Req() req: AuthRequest) {
    if (req.user.role !== Role.student) {
      return { user: req.user, profile: null };
    }

    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: req.user.id },
      select: { firstName: true, lastName: true },
    });

    return { user: req.user, profile };
  }
}
