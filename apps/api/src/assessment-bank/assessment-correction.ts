import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { assessmentPresentationCompatible } from '../common/assessment-presentation';
import { StoredAssessmentTaskSchema, type StoredAssessmentTask } from './assessment-bank.mapper';

export type BankCorrection = { taskId: string; expectedVersion: number };
export async function validateAssessmentCorrection(tx: Prisma.TransactionClient, teacherId: string, input: BankCorrection, entries: StoredAssessmentTask[]) {
  const row = await tx.assessmentBankTask.findFirst({ where: { id: input.taskId, teacherId, deletedAt: null }, include: { latestVersion: true } });
  if (!row?.latestVersion) throw new NotFoundException('Задание недоступно в вашем банке.');
  if (row.latestVersion.version !== input.expectedVersion) throw new ConflictException('Задание изменилось. Закройте исправление и откройте его заново.');
  if (entries.length !== 1 || entries[0].task.id !== row.stableId) throw new BadRequestException(`В ZIP должна быть только задача ${row.stableId} с прежним ID.`);
  const original = StoredAssessmentTaskSchema.parse(row.latestVersion.data);
  if (!assessmentPresentationCompatible(original.task, entries[0].task)) throw new BadRequestException('Можно исправить только условие, рисунки и текст вариантов. Тип, ключ ответа, баллы, ID и порядок вариантов, название и сведения должны остаться прежними.');
}
