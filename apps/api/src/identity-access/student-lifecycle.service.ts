import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { StudentsBulkDelete, StudentsBulkRestore } from '@continuum/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { classTransaction } from './school-class-policy';

const changed = () => new ConflictException({ code: 'STUDENT_STATE_CHANGED', message: 'Состояние ученика изменилось. Обновите список и повторите действие.' });

@Injectable()
export class StudentLifecycleService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async student(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
    const user = await tx.user.findFirst({ where: { id, role: 'student' }, include: { studentProfile: true } });
    if (!user?.studentProfile) throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Ученик не найден.' });
    return { user, profile: user.studentProfile };
  }

  async removeMany(input: StudentsBulkDelete) {
    return classTransaction(this.prisma, async tx => {
      const items = [];
      for (const item of [...input.items].sort((a, b) => a.id.localeCompare(b.id))) {
        const { user, profile } = await this.student(tx, item.id);
        if (profile.deletedAt && profile.lifecycleRevision === item.expectedRevision + 1) {
          items.push({ id: item.id, deletionRevision: profile.lifecycleRevision }); continue;
        }
        if (profile.deletedAt || profile.lifecycleRevision !== item.expectedRevision) throw changed();
        const removed = await tx.studentProfile.update({ where: { userId: item.id }, data: { deletedAt: new Date(), deletedWasActive: user.isActive, lifecycleRevision: { increment: 1 } } });
        await tx.user.update({ where: { id: item.id }, data: { isActive: false } });
        await tx.session.deleteMany({ where: { userId: item.id } });
        items.push({ id: item.id, deletionRevision: removed.lifecycleRevision });
      }
      return { items };
    });
  }

  async restoreMany(input: StudentsBulkRestore) {
    return classTransaction(this.prisma, async tx => {
      const items = [];
      for (const item of [...input.items].sort((a, b) => a.id.localeCompare(b.id))) {
        const { profile } = await this.student(tx, item.id);
        if (!profile.deletedAt && profile.lifecycleRevision === item.deletionRevision + 1) { items.push({ id: item.id }); continue; }
        if (!profile.deletedAt || profile.lifecycleRevision !== item.deletionRevision) throw changed();
        await tx.studentProfile.update({ where: { userId: item.id }, data: { deletedAt: null, deletedWasActive: null, lifecycleRevision: { increment: 1 } } });
        await tx.user.update({ where: { id: item.id }, data: { isActive: profile.deletedWasActive ?? false } });
        items.push({ id: item.id });
      }
      return { items };
    });
  }

  async removeOne(id: string) {
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId: id } });
    if (!profile || profile.deletedAt) throw changed();
    return (await this.removeMany({ items: [{ id, expectedRevision: profile.lifecycleRevision }] })).items[0];
  }
}
