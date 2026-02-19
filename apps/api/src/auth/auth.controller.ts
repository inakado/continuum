import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthRequest } from './auth.request';
import {
  resolveAuthCookieName,
  resolveAuthCookieOptions,
  resolveRefreshCookieName,
  resolveRefreshCookieOptions,
} from './auth.config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private resolveRequestContext(req: Request) {
    const ip = (req.ip || req.socket?.remoteAddress || null) as string | null;
    const userAgent = req.get('user-agent') || null;
    return { ip, userAgent };
  }

  private resolveRefreshToken(req: Request) {
    const cookieName = resolveRefreshCookieName();
    const candidate = req.cookies?.[cookieName];
    if (!candidate || typeof candidate !== 'string') {
      return null;
    }
    return candidate;
  }

  private resolveAllowedOrigins() {
    const defaultWebPort = Number(process.env.WEB_PORT || 3001);
    const fallbackOrigin = `http://localhost:${defaultWebPort}`;
    const corsOriginRaw = process.env.CORS_ORIGIN || process.env.WEB_ORIGIN || fallbackOrigin;
    return corsOriginRaw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  private resolveRequestOrigin(req: Request) {
    const origin = req.get('origin');
    if (origin) return origin;

    const referer = req.get('referer');
    if (!referer) return null;

    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  private assertTrustedOrigin(req: Request) {
    const requestOrigin = this.resolveRequestOrigin(req);
    if (!requestOrigin) {
      return;
    }

    const allowedOrigins = this.resolveAllowedOrigins();
    if (allowedOrigins.includes('*')) {
      return;
    }

    if (!allowedOrigins.includes(requestOrigin)) {
      throw new ForbiddenException({
        code: 'AUTH_ORIGIN_DENIED',
        message: 'Origin is not allowed for this auth operation.',
      });
    }
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie(resolveAuthCookieName(), accessToken, resolveAuthCookieOptions());
    res.cookie(resolveRefreshCookieName(), refreshToken, resolveRefreshCookieOptions());
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie(resolveAuthCookieName(), { ...resolveAuthCookieOptions(), maxAge: 0 });
    res.clearCookie(resolveRefreshCookieName(), { ...resolveRefreshCookieOptions(), maxAge: 0 });
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(req.user, this.resolveRequestContext(req));
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertTrustedOrigin(req);
    const refreshToken = this.resolveRefreshToken(req);
    if (!refreshToken) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Refresh token is missing.',
      });
    }

    try {
      const result = await this.authService.refresh(refreshToken, this.resolveRequestContext(req));
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      return { user: result.user };
    } catch (error) {
      this.clearAuthCookies(res);
      throw error;
    }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertTrustedOrigin(req);
    const refreshToken = this.resolveRefreshToken(req);
    await this.authService.logoutByRefreshToken(refreshToken);
    this.clearAuthCookies(res);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: AuthRequest) {
    if (req.user.role === Role.student) {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: req.user.id },
        select: { firstName: true, lastName: true },
      });

      return { user: req.user, profile };
    }

    if (req.user.role === Role.teacher) {
      const profile = await this.prisma.teacherProfile.findUnique({
        where: { userId: req.user.id },
        select: { firstName: true, lastName: true, middleName: true },
      });

      return { user: req.user, profile };
    }

    return { user: req.user, profile: null };
  }
}
