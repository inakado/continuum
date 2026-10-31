import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import argon2 from 'argon2';
import { reviewerPolicy, type ReviewerKeyCreate, ReviewerKeySchema } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { ContinuumBetterAuth } from '../auth/better-auth.factory';
import { unavailable } from './reviewer-auth.service';

@Injectable()
export class ReviewerKeysService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(AuthService) private readonly auth: AuthService<ContinuumBetterAuth>) {}
  async targets() {
    const [classes, students] = await Promise.all([
      this.db.schoolClass.findMany({ select: { id: true, title: true, academicYear: true, isArchived: true }, orderBy: [{ isArchived: 'asc' }, { academicYear: 'desc' }, { title: 'asc' }] }),
      this.db.user.findMany({ where: { role: 'student', isActive: true, studentProfile: { isNot: null } }, select: { id: true, name: true, login: true, studentProfile: { select: { classId: true } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    ]);
    return { classes, students: students.map((row) => ({ id: row.id, name: row.name, login: row.login, classId: row.studentProfile!.classId })) };
  }
  async list(userId: string) {
    const rows = await this.db.reviewerDeviceKey.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const apiKeys = new Map((await this.db.apikey.findMany({ where: { id: { in: rows.map((row) => row.id) } }, select: { id: true, lastRequest: true } })).map((key) => [key.id, key]));
    return rows.map((row) => ReviewerKeySchema.parse({ id: row.id, name: row.name, scopes: row.scopes, classIds: row.classIds, studentIds: row.studentIds, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt?.toISOString() ?? null, revokedAt: row.revokedAt?.toISOString() ?? null, lastUsedAt: apiKeys.get(row.id)?.lastRequest?.toISOString() ?? null }));
  }
  async create(userId: string, input: ReviewerKeyCreate) {
    const account = await this.db.account.findFirst({ where: { userId, providerId: 'credential' } });
    if (!account?.password || !await argon2.verify(account.password, input.password)) throw new UnauthorizedException({ code: 'PASSWORD_INVALID', message: 'Неверный пароль.' });
    const [classes, students] = await Promise.all([
      this.db.schoolClass.count({ where: { id: { in: input.classIds } } }),
      this.db.user.count({ where: { id: { in: input.studentIds }, role: 'student', isActive: true, studentProfile: { isNot: null } } }),
    ]);
    if (classes !== input.classIds.length || students !== input.studentIds.length) throw new BadRequestException('Выбранный класс или ученик больше недоступен. Обновите список.');
    if (await this.db.reviewerDeviceKey.count({ where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }) >= 20) throw new BadRequestException('Сначала отзовите неиспользуемые ключи.');
    const scopes = ['read', 'draft:write', 'publish'];
    const created = await this.auth.api.createApiKey({ body: { userId, name: input.name, prefix: 'ctm_', expiresIn: reviewerPolicy.keyExpiresIn, permissions: { reviewer: scopes } } });
    try {
      await this.db.reviewerDeviceKey.create({ data: { id: created.id, userId, name: input.name, scopes, classIds: input.classIds, studentIds: input.studentIds, expiresAt: created.expiresAt } });
      return { key: created.key, entry: (await this.list(userId)).find((row) => row.id === created.id)! };
    } catch (error) { await this.db.apikey.update({ where: { id: created.id }, data: { enabled: false } }); throw error; }
  }
  async revoke(userId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      const key = await tx.reviewerDeviceKey.findFirst({ where: { id, userId } });
      if (!key) throw unavailable();
      await tx.reviewerDeviceKey.update({ where: { id }, data: { revokedAt: key.revokedAt ?? new Date() } });
      await tx.apikey.update({ where: { id }, data: { enabled: false } });
      return { ok: true };
    });
  }
}
