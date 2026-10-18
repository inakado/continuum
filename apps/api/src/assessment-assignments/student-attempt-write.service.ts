import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { AssessmentAnswer, AssessmentPackageTask, AttemptSave } from '@continuum/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';
import { StudentAttemptReadService } from './student-attempt-read.service';
import { answersSchema, attemptState, inputHash, json } from './assignment-data';
import { answerIsFilled, gradeAssessmentAnswer } from './assessment-grading';

function validateAnswer(answer: AssessmentAnswer | null, task: AssessmentPackageTask) {
  if (!answer) return;
  if (answer.type !== task.type) throw new BadRequestException('Тип ответа не соответствует заданию.');
  const allowed = 'options' in task ? new Set(task.options.map((item) => item.id)) : new Set<string>();
  let selected: string[];
  switch (answer.type) {
    case 'single_choice': selected = answer.optionId ? [answer.optionId] : []; break;
    case 'multiple_choice': selected = answer.optionIds; break;
    case 'matching': selected = Object.values(answer.matches); break;
    default: selected = [];
  }
  if (selected.some((id) => !allowed.has(id))) throw new BadRequestException('Вариант ответа отсутствует в задании.');
  if (answer.type === 'matching' && task.type === 'matching' && Object.keys(answer.matches).some((id) => !task.rows.some((row) => row.id === id))) throw new BadRequestException('Позиция соответствия отсутствует в задании.');
}
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
      if (row.startedAt) return attemptState(row);
      return attemptState(await tx.assessmentRecipient.update({ where: { id }, data: { startedAt: new Date() } }));
    });
  }
  save(studentId: string, id: string, taskId: string, input: AttemptSave) {
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, studentId, id);
      const hash = inputHash({ taskId, ...input });
      if (row.lastRequestId === input.requestId) {
        if (row.lastInputHash !== hash) throw new ConflictException('Ключ ответа уже использован для других данных.');
        return attemptState(row);
      }
      if (row.completedAt) throw new ConflictException('Работа завершена. Ответы больше нельзя менять.');
      if (!row.startedAt) throw new ConflictException('Сначала начните работу.');
      if (row.revision !== input.expectedRevision) throw new ConflictException('Ответы изменились в другой вкладке. Загрузите сохранённую работу.');
      const snapshot = WorkSnapshotSchema.parse(row.version.data);
      const item = snapshot.items.find((entry) => entry.taskId === taskId);
      if (!item) throw new BadRequestException('Задание не входит в работу.');
      if (item.data.task.type === 'extended') throw new BadRequestException('Фотографии сохраняются отдельно от тестовых ответов.');
      validateAnswer(input.answer, item.data.task);
      const answers = answersSchema.parse(row.answers);
      if (input.answer) answers[taskId] = input.answer; else delete answers[taskId];
      const answeredCount = snapshot.items.filter((entry) => answerIsFilled(answers[entry.taskId], entry.data.task)).length;
      return attemptState(await tx.assessmentRecipient.update({ where: { id }, data: { answers: json(answers), answeredCount, revision: { increment: 1 }, lastRequestId: input.requestId, lastInputHash: hash } }));
    }, { timeout: 30000 });
  }
  finish(studentId: string, id: string, expectedRevision: number) {
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, studentId, id);
      if (row.completedAt) return attemptState(row);
      if (!row.startedAt || row.revision !== expectedRevision) throw new ConflictException('Сначала сохраните актуальные ответы и повторите завершение.');
      const snapshot = WorkSnapshotSchema.parse(row.version.data);
      const answers = answersSchema.parse(row.answers);
      const automatic = snapshot.items.filter((item) => item.data.task.type !== 'extended');
      if (!automatic.length) throw new BadRequestException('В этой работе нет тестовой части. Фотографии сохраняются отдельно.');
      const scores = automatic.map((item) => gradeAssessmentAnswer(item.data.task, answers[item.taskId] ?? null));
      const correctCount = scores.filter((score) => score > 0).length;
      return attemptState(await tx.assessmentRecipient.update({ where: { id }, data: {
        completedAt: new Date(), revision: { increment: 1 }, points: scores.reduce((sum, value) => sum + value, 0), correctCount, incorrectCount: scores.length - correctCount,
      } }));
    }, { timeout: 30000 });
  }
}
