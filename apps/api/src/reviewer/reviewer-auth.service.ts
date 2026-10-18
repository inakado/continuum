import { ForbiddenException, HttpException, Inject, Injectable, NotFoundException, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import type { ReviewerScope } from '@continuum/shared';
import type { ContinuumBetterAuth } from '../auth/better-auth.factory';
import { PrismaService } from '../prisma/prisma.service';

export const REVIEWER_SCOPE = 'reviewer_scope';
export const ReviewerAccess = (scope: ReviewerScope) => SetMetadata(REVIEWER_SCOPE, scope);
export type ReviewerPrincipal = { userId: string; login: string; keyId: string; scopes: string[]; classIds: string[]; studentIds: string[]; expiresAt: Date };
export type ReviewerRequest = Request & { reviewer: ReviewerPrincipal };
export const unavailable = () => new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Материал недоступен.' });

@Injectable()
export class ReviewerAuthService {
  private readonly windows = new Map<string, { until: number; count: number }>();
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(AuthService) private readonly auth: AuthService<ContinuumBetterAuth>) {}

  private rate(id: string, limit: number) {
    const now = Date.now();
    for (const [key, value] of this.windows) if (value.until <= now) this.windows.delete(key);
    const window = this.windows.get(id) ?? { until: now + 60000, count: 0 };
    window.count++; this.windows.set(id, window);
    if (window.count > limit) throw new HttpException({ code: 'RATE_LIMITED', message: 'Слишком много запросов. Повторите через минуту.' }, 429);
  }
  async authenticate(request: ReviewerRequest, scope: ReviewerScope) {
    const header = request.headers.authorization;
    if (!header || !/^Bearer [^\s]{16,512}$/.test(header)) throw new UnauthorizedException({ code: 'KEY_INVALID', message: 'Нужен ключ проверяющего.' });
    const verified = await this.auth.api.verifyApiKey({ body: { key: header.slice(7) } });
    if (!verified.valid || !verified.key) {
      if (verified.error?.code.includes('RATE_LIMIT')) { request.res?.setHeader('Retry-After', '60'); throw new HttpException({ code: 'RATE_LIMITED', message: 'Слишком много запросов.' }, 429); }
      throw new UnauthorizedException({ code: 'KEY_INVALID', message: 'Ключ недействителен, истёк или отозван.' });
    }
    const key = await this.db.reviewerDeviceKey.findUnique({ where: { id: verified.key.id }, include: { user: true } });
    if (!key || key.revokedAt || key.expiresAt <= new Date() || !key.user.isActive || key.user.role !== 'teacher' || !key.classIds.length && !key.studentIds.length) throw new UnauthorizedException({ code: 'KEY_INVALID', message: 'Доступ агента прекращён.' });
    if (!key.scopes.includes(scope)) throw new ForbiddenException({ code: 'SCOPE_REQUIRED', message: 'У ключа нет нужного разрешения.' });
    request.res?.setHeader('Retry-After', '60');
    this.rate(`u:${key.userId}`, 600);
    if (scope !== 'read') { this.rate(`w:${key.id}`, 30); this.rate(`uw:${key.userId}`, 150); }
    request.res?.removeHeader('Retry-After');
    request.reviewer = { userId: key.userId, login: key.user.login, keyId: key.id, scopes: key.scopes, classIds: key.classIds, studentIds: key.studentIds, expiresAt: key.expiresAt };
    return true;
  }
  recipients(principal: ReviewerPrincipal): Prisma.AssessmentRecipientWhereInput {
    return { student: { is: { role: 'student', isActive: true, studentProfile: { isNot: null }, OR: [
      { id: { in: principal.studentIds } },
      { studentProfile: { is: { classId: { in: principal.classIds } } } },
    ] } } };
  }
  async assignment(principal: ReviewerPrincipal, id: string, scope: ReviewerScope, tx: Prisma.TransactionClient = this.db) {
    if (!principal.scopes.includes(scope)) throw new ForbiddenException({ code: 'SCOPE_REQUIRED', message: 'Нет нужного разрешения.' });
    const row = await tx.assessmentAssignment.findFirst({ where: { id, recipients: { some: this.recipients(principal) } }, include: { version: { include: { work: true } } } });
    if (!row) throw unavailable();
    return row;
  }
  async lockPrincipal(principal: ReviewerPrincipal, scope: ReviewerScope, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${principal.userId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM reviewer_device_keys WHERE id = ${principal.keyId}::uuid FOR UPDATE`;
    const key = await tx.reviewerDeviceKey.findUnique({ where: { id: principal.keyId }, include: { user: true } });
    const apiKey = await tx.apikey.findUnique({ where: { id: principal.keyId } });
    if (!key || key.revokedAt || key.expiresAt <= new Date() || !key.user.isActive || key.user.role !== 'teacher' || !apiKey?.enabled || !apiKey.expiresAt || apiKey.expiresAt <= new Date() || !key.classIds.length && !key.studentIds.length) throw new UnauthorizedException({ code: 'KEY_INVALID', message: 'Ключ недействителен.' });
    if (!key.scopes.includes(scope)) throw new ForbiddenException({ code: 'SCOPE_REQUIRED', message: 'Нет нужного разрешения.' });
  }
}
