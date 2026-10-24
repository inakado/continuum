import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AssessmentWorkArchive, AssessmentWorkDelete } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssessmentWorkLifecycleService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  private async lock(tx: Prisma.TransactionClient, teacherId: string, id: string) {
    await tx.$queryRaw`SELECT id FROM assessment_works WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid FOR UPDATE`;
    const row = await tx.assessmentWork.findFirst({ where: { id, teacherId } });
    if (!row) throw new NotFoundException('Работа не найдена.');
    return row;
  }
  archive(teacherId: string, id: string, input: AssessmentWorkArchive) {
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, teacherId, id);
      if (row.deletedAt) throw new NotFoundException('Работа не найдена.');
      if (Boolean(row.archivedAt) === input.isArchived) return { id };
      if (row.lifecycleRevision !== input.expectedLifecycleRevision) throw new ConflictException('Состояние работы изменилось. Обновите список и повторите действие.');
      await tx.assessmentWork.update({ where: { id }, data: { archivedAt: input.isArchived ? new Date() : null, lifecycleRevision: { increment: 1 } } });
      return { id };
    });
  }
  remove(teacherId: string, id: string, input: AssessmentWorkDelete) {
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, teacherId, id);
      if (row.deletedAt) return { id };
      if (row.revision !== input.expectedRevision || row.lifecycleRevision !== input.expectedLifecycleRevision) throw new ConflictException('Работа изменилась. Закройте окно и проверьте её перед удалением.');
      const used = await tx.assessmentAssignment.count({ where: { version: { workId: id } } });
      if (used) throw new ConflictException('Работа уже назначена. Её можно отправить в архив, но нельзя удалить.');
      await tx.assessmentWork.update({ where: { id }, data: { deletedAt: new Date(), lifecycleRevision: { increment: 1 } } });
      return { id };
    });
  }
}
