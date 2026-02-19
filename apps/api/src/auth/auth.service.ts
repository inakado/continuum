import { createHash, randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { resolveRefreshExpiresInDays } from './auth.config';
import { AuthUser, JwtPayload } from './auth.types';

const AUTH_ERRORS = {
  REFRESH_TOKEN_INVALID: {
    code: 'REFRESH_TOKEN_INVALID',
    message: 'Refresh token is invalid or expired.',
  },
  REFRESH_TOKEN_REUSED: {
    code: 'REFRESH_TOKEN_REUSED',
    message: 'Refresh token reuse detected. Session revoked.',
  },
  SESSION_REVOKED: {
    code: 'SESSION_REVOKED',
    message: 'Session revoked or expired.',
  },
} as const;

type SessionContext = {
  ip: string | null;
  userAgent: string | null;
};

type AuthTokensResult = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private throwAuthError(error: (typeof AUTH_ERRORS)[keyof typeof AUTH_ERRORS]): never {
    throw new UnauthorizedException({ code: error.code, message: error.message });
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateRefreshToken() {
    return randomBytes(32).toString('base64url');
  }

  private async signAccessToken(user: AuthUser, sessionId: string) {
    const payload: JwtPayload = { sub: user.id, sid: sessionId, typ: 'access' };
    return this.jwtService.signAsync(payload);
  }

  private getRefreshExpiry(now: Date) {
    const expiresInDays = resolveRefreshExpiresInDays();
    return new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
  }

  private async revokeSessionFamily(
    tx: Prisma.TransactionClient,
    sessionId: string,
    reason: string,
    at: Date,
  ) {
    await tx.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: at, revokeReason: reason, lastUsedAt: at },
    });
    await tx.authRefreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  private normalizeAuthUser(user: { id: string; login: string; role: Role }): AuthUser {
    return {
      id: user.id,
      login: user.login,
      role: user.role,
    };
  }

  async validateUser(login: string, password: string): Promise<AuthUser | null> {
    const user = await this.usersService.findByLogin(login);
    if (!user || !user.isActive) {
      return null;
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      return null;
    }

    return { id: user.id, login: user.login, role: user.role };
  }

  async login(user: AuthUser, context: SessionContext): Promise<AuthTokensResult> {
    const now = new Date();
    const sessionExpiresAt = this.getRefreshExpiry(now);
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        expiresAt: sessionExpiresAt,
        lastUsedAt: now,
        userAgent: context.userAgent,
        ipCreated: context.ip,
        ipLastUsed: context.ip,
      },
      select: { id: true },
    });

    await this.prisma.authRefreshToken.create({
      data: {
        sessionId: session.id,
        tokenHash: refreshTokenHash,
        expiresAt: sessionExpiresAt,
      },
    });

    const accessToken = await this.signAccessToken(user, session.id);
    return { user, accessToken, refreshToken };
  }

  async refresh(refreshToken: string, context: SessionContext): Promise<AuthTokensResult> {
    const now = new Date();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const rotated = await this.prisma.$transaction(async (tx) => {
      const token = await tx.authRefreshToken.findUnique({
        where: { tokenHash: refreshTokenHash },
        include: {
          session: {
            include: {
              user: {
                select: {
                  id: true,
                  login: true,
                  role: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (!token) {
        return { error: AUTH_ERRORS.REFRESH_TOKEN_INVALID } as const;
      }

      const session = token.session;
      const user = session.user;
      if (!user.isActive) {
        await this.revokeSessionFamily(tx, session.id, AUTH_ERRORS.SESSION_REVOKED.code, now);
        return { error: AUTH_ERRORS.SESSION_REVOKED } as const;
      }

      if (session.revokedAt || session.expiresAt <= now) {
        await this.revokeSessionFamily(tx, session.id, AUTH_ERRORS.SESSION_REVOKED.code, now);
        return { error: AUTH_ERRORS.SESSION_REVOKED } as const;
      }

      if (token.revokedAt || token.expiresAt <= now) {
        await this.revokeSessionFamily(tx, session.id, AUTH_ERRORS.REFRESH_TOKEN_INVALID.code, now);
        return { error: AUTH_ERRORS.REFRESH_TOKEN_INVALID } as const;
      }

      if (token.usedAt) {
        await this.revokeSessionFamily(tx, session.id, AUTH_ERRORS.REFRESH_TOKEN_REUSED.code, now);
        return { error: AUTH_ERRORS.REFRESH_TOKEN_REUSED } as const;
      }

      const nextRefreshToken = this.generateRefreshToken();
      const nextRefreshTokenHash = this.hashRefreshToken(nextRefreshToken);
      const nextRefresh = await tx.authRefreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: nextRefreshTokenHash,
          expiresAt: session.expiresAt,
        },
        select: { id: true },
      });

      const consume = await tx.authRefreshToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          revokedAt: null,
        },
        data: {
          usedAt: now,
          replacedByTokenId: nextRefresh.id,
        },
      });

      if (consume.count !== 1) {
        await this.revokeSessionFamily(tx, session.id, AUTH_ERRORS.REFRESH_TOKEN_REUSED.code, now);
        return { error: AUTH_ERRORS.REFRESH_TOKEN_REUSED } as const;
      }

      await tx.authSession.update({
        where: { id: session.id },
        data: {
          lastUsedAt: now,
          ipLastUsed: context.ip,
        },
      });

      return {
        user: this.normalizeAuthUser(user),
        sessionId: session.id,
        refreshToken: nextRefreshToken,
      } as const;
    });

    if ('error' in rotated && rotated.error) {
      this.throwAuthError(rotated.error);
    }

    const accessToken = await this.signAccessToken(rotated.user, rotated.sessionId);
    return {
      user: rotated.user,
      accessToken,
      refreshToken: rotated.refreshToken,
    };
  }

  async logoutByRefreshToken(refreshToken: string | null | undefined) {
    if (!refreshToken) {
      return;
    }

    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    await this.prisma.$transaction(async (tx) => {
      const token = await tx.authRefreshToken.findUnique({
        where: { tokenHash: refreshTokenHash },
        select: { sessionId: true },
      });

      if (!token) {
        return;
      }

      await this.revokeSessionFamily(tx, token.sessionId, 'LOGOUT', new Date());
    });
  }

  async validateAccessPayload(payload: JwtPayload): Promise<AuthUser> {
    if (payload.typ !== 'access' || !payload.sid) {
      this.throwAuthError(AUTH_ERRORS.SESSION_REVOKED);
    }

    const now = new Date();
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: {
            id: true,
            login: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= now) {
      this.throwAuthError(AUTH_ERRORS.SESSION_REVOKED);
    }

    if (!session.user.isActive) {
      this.throwAuthError(AUTH_ERRORS.SESSION_REVOKED);
    }

    return this.normalizeAuthUser(session.user);
  }
}
