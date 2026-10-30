import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { AttemptSave } from '@continuum/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';
import { StudentAttemptReadService } from './student-attempt-read.service';
import { answersSchema, attemptState, inputHash, json } from './assignment-data';
import { applyAssessmentPresentations } from '../common/assessment-presentation';
import { answerIsFilled, gradeAssessmentAnswer, validateAssessmentAnswer } from '../common/assessment-grading';

@Injectable()
export class StudentAttemptWriteService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(StudentAttemptReadService) private readonly reads: StudentAttemptReadService) {}
  private async lock(tx: Prisma.TransactionClient, studentId: string, id: string) {
    await tx.$queryRaw`SELECT id FROM assessment_recipients WHERE id = ${id}::uuid AND student_id = ${studentId}::uuid FOR UPDATE`;
    return this.reads.owned(studentId, id, tx);
  }
  start(studentId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, studentId, id);
      const snapshot = WorkSnapshotSchema.parse(row.version.data);
      snapshot.items = await applyAssessmentPresentations(tx, snapshot.items);
      if (row.startedAt) return attemptState(row, snapshot);
      return attemptState(await tx.assessmentRecipient.update({ where: { id }, data: { startedAt: new Date() } }), snapshot);
    });
  }
  save(studentId: string, id: string, taskId: string, input: AttemptSave) {
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, studentId, id);
      const snapshot = WorkSnapshotSchema.parse(row.version.data);
      snapshot.items = await applyAssessmentPresentations(tx, snapshot.items);
      const hash = inputHash({ taskId, ...input });
      if (row.lastRequestId === input.requestId) {
        if (row.lastInputHash !== hash) throw new ConflictException('Ключ ответа уже использован для других данных.');
        return attemptState(row, snapshot);
      }
      if (row.completedAt) throw new ConflictException('Работа завершена. Ответы больше нельзя менять.');
      if (!row.startedAt) throw new ConflictException('Сначала начните работу.');
      if (row.revision !== input.expectedRevision) throw new ConflictException('Ответы изменились в другой вкладке. Загрузите сохранённую работу.');
      const item = snapshot.items.find((entry) => entry.taskId === taskId);
      if (!item) throw new BadRequestException('Задание не входит в работу.');
      if (item.data.task.type === 'extended') throw new BadRequestException('Фотографии сохраняются отдельно от тестовых ответов.');
      validateAssessmentAnswer(input.answer, item.data.task);
      const answers = answersSchema.parse(row.answers);
      if (input.answer) answers[taskId] = input.answer; else delete answers[taskId];
      const answeredCount = snapshot.items.filter((entry) => answerIsFilled(answers[entry.taskId], entry.data.task)).length;
      return attemptState(await tx.assessmentRecipient.update({ where: { id }, data: { answers: json(answers), answeredCount, revision: { increment: 1 }, lastRequestId: input.requestId, lastInputHash: hash } }), snapshot);
    }, { timeout: 30000 });
  }
  finish(studentId: string, id: string, expectedRevision: number) {
    return this.db.$transaction(async (tx) => {
      const owned = await this.reads.owned(studentId, id, tx);
      const owner = await tx.assessmentWork.findUniqueOrThrow({ where: { id: owned.version.workId }, select: { teacherId: true } });
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${owner.teacherId}::uuid FOR UPDATE`;
      const row = await this.lock(tx, studentId, id);
      const snapshot = WorkSnapshotSchema.parse(row.version.data);
      snapshot.items = await applyAssessmentPresentations(tx, snapshot.items);
      if (row.completedAt) return attemptState(row, snapshot);
      if (!row.startedAt || row.revision !== expectedRevision) throw new ConflictException('Сначала сохраните актуальные ответы и повторите завершение.');
      const answers = answersSchema.parse(row.answers);
      const automatic = snapshot.items.filter((item) => item.data.task.type !== 'extended');
      if (!automatic.length) throw new BadRequestException('В этой работе нет тестовой части. Фотографии сохраняются отдельно.');
      const scores = automatic.map((item) => gradeAssessmentAnswer(item.data.task, answers[item.taskId] ?? null));
      const correctCount = scores.filter((score, index) => score === automatic[index].data.task.maxPoints).length;
      return attemptState(await tx.assessmentRecipient.update({ where: { id }, data: {
        completedAt: new Date(), revision: { increment: 1 }, points: scores.reduce((sum, value) => sum + value, 0), correctCount, incorrectCount: scores.filter((score) => score === 0).length,
      } }), snapshot);
    }, { timeout: 30000 });
  }
}
