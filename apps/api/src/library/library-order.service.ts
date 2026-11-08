import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { GradeBand, ReorderLibraryInput, ReorderSectionsInput } from '@continuum/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export async function lockSectionOrder(tx: Prisma.TransactionClient, gradeBand: GradeBand) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`library.sections:${gradeBand}`}, 0))::text`;
}

export async function lockSectionLessons(tx: Prisma.TransactionClient, sectionId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM sections WHERE id = ${sectionId}::uuid FOR UPDATE`;
  if (!rows.length) throw new NotFoundException({ code: 'SECTION_NOT_FOUND', message: 'Раздел не найден.' });
}

function checkOrder(current: string[], input: ReorderLibraryInput) {
  if (current.length !== input.expectedIds.length || current.some((id, index) => id !== input.expectedIds[index])) {
    // A lost response may be retried safely when the intended order is already present.
    if (current.length === input.orderedIds.length && current.every((id, index) => id === input.orderedIds[index])) return;
    throw new ConflictException({ code: 'LIBRARY_ORDER_CHANGED', message: 'Список уже изменился. Обновите материалы и повторите перемещение.' });
  }
}

@Injectable()
export class LibraryOrderService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  sections(input: ReorderSectionsInput) {
    return this.db.$transaction(async (tx) => {
      await lockSectionOrder(tx, input.gradeBand);
      const rows = await tx.section.findMany({ where: { gradeBand: input.gradeBand }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true } });
      checkOrder(rows.map((row) => row.id), input);
      for (const [sortOrder, id] of input.orderedIds.entries()) await tx.section.update({ where: { id }, data: { sortOrder } });
      return { orderedIds: input.orderedIds };
    });
  }

  lessons(sectionId: string, input: ReorderLibraryInput) {
    return this.db.$transaction(async (tx) => {
      await lockSectionLessons(tx, sectionId);
      const rows = await tx.lesson.findMany({ where: { sectionId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true } });
      checkOrder(rows.map((row) => row.id), input);
      for (const [sortOrder, id] of input.orderedIds.entries()) await tx.lesson.update({ where: { id }, data: { sortOrder } });
      return { orderedIds: input.orderedIds };
    });
  }
}
