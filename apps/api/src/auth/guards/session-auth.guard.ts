import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import { PrismaService } from '../../prisma/prisma.service';
import type { ContinuumBetterAuth } from '../better-auth.factory';
import { ALLOW_ANONYMOUS_KEY } from '../decorators/allow-anonymous.decorator';
import type { AuthUser } from '../auth.types';

const isRole = (value: unknown): value is Role =>
  value === Role.admin || value === Role.teacher || value === Role.student;

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(BetterAuthService)
    private readonly betterAuth: BetterAuthService<ContinuumBetterAuth>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowAnonymous = this.reflector.getAllAndOverride<boolean>(ALLOW_ANONYMOUS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowAnonymous) return true;

    const request = context.switchToHttp().getRequest();
    const session = await this.betterAuth.api.getSession({
      headers: fromNodeHeaders(request.headers ?? {}),
    });

    if (!session) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required.',
      });
    }

    const { user } = session;
    const login = user.username;
    if (typeof user.id !== 'string' || typeof login !== 'string' || !isRole(user.role)) {
      throw new UnauthorizedException({
        code: 'SESSION_INVALID',
        message: 'Session identity is invalid.',
      });
    }

    if (user.isActive !== true) {
      await this.prisma.session.deleteMany({ where: { userId: user.id } });
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED',
        message: 'Session revoked or expired.',
      });
    }

    const principal: AuthUser = { id: user.id, login, role: user.role };
    request.session = session;
    request.user = principal;
    return true;
  }
}
