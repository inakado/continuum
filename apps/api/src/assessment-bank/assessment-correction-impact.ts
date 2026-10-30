import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AssessmentCorrectionImpact } from '@continuum/shared';
import { WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';
import { answersSchema, inputHash } from '../assessment-assignments/assignment-data';
import { gradeAssessmentAnswer } from '../common/assessment-grading';
import { applyAssessmentPresentations, assessmentPresentationCompatible } from '../common/assessment-presentation';
import type { StoredAssessmentTask } from './assessment-bank.mapper';

export async function assessmentCorrectionImpact(tx: Prisma.TransactionClient, teacherId: string, taskId: string, original: StoredAssessmentTask, replacement: StoredAssessmentTask, lock = false) {
  const versions = await tx.assessmentWorkVersion.findMany({ where: { work: { teacherId } }, orderBy: { id: 'asc' }, select: { id: true, workId: true, data: true } });
  const candidates = versions.map(row => ({ row, snapshot: WorkSnapshotSchema.parse(row.data) })).filter(({ snapshot }) => snapshot.items.some(item => item.taskId === taskId));
  const resolved = await applyAssessmentPresentations(tx, candidates.flatMap(({ snapshot }) => snapshot.items));
  const affected = []; let offset = 0;
  for (const { row, snapshot } of candidates) {
    const items = resolved.slice(offset, offset += snapshot.items.length);
    const task = items.find(item => item.taskId === taskId)!;
    if (assessmentPresentationCompatible(task.data.task, original.task)) affected.push({ row, snapshot: { ...snapshot, items } });
  }
  const versionIds = affected.map(item => item.row.id);
  if (lock && versionIds.length) await tx.$queryRaw`SELECT id FROM assessment_recipients WHERE version_id IN (${Prisma.join(versionIds.map(id => Prisma.sql`${id}::uuid`))}) AND completed_at IS NOT NULL ORDER BY id FOR UPDATE`;
  const rows = versionIds.length ? await tx.assessmentRecipient.findMany({ where: { versionId: { in: versionIds }, completedAt: { not: null } }, orderBy: { id: 'asc' },
    select: { id: true, versionId: true, studentName: true, revision: true, answers: true, points: true, correctCount: true, incorrectCount: true, completedAt: true } }) : [];
  const snapshots = new Map(affected.map(item => [item.row.id, item.snapshot]));
  const changes: AssessmentCorrectionImpact['changes'] = [];
  const updates = [];
  for (const row of rows) {
    const snapshot = snapshots.get(row.versionId)!;
    const answers = answersSchema.parse(row.answers);
    const automatic = snapshot.items.filter(item => item.data.task.type !== 'extended');
    const oldScores = automatic.map(item => gradeAssessmentAnswer(item.data.task, answers[item.taskId] ?? null));
    const before = oldScores.reduce((sum, n) => sum + n, 0);
    const oldCorrect = oldScores.filter((n, i) => n === automatic[i].data.task.maxPoints).length;
    if (before !== row.points || oldCorrect !== row.correctCount || oldScores.filter(n => n === 0).length !== row.incorrectCount) {
      throw new ConflictException('Сохранённый итог одной из работ не соответствует закреплённой шкале. Автоматическое исправление остановлено; ответы не изменены.');
    }
    const index = automatic.findIndex(item => item.taskId === taskId);
    const scores = [...oldScores]; scores[index] = gradeAssessmentAnswer(replacement.task, answers[taskId] ?? null);
    const points = scores.reduce((sum, n) => sum + n, 0);
    const correctCount = scores.filter((n, i) => n === automatic[i].data.task.maxPoints).length;
    const incorrectCount = scores.filter(n => n === 0).length;
    if (points !== row.points || correctCount !== row.correctCount || incorrectCount !== row.incorrectCount) updates.push({ id: row.id, points, correctCount, incorrectCount });
    if (scores[index] !== oldScores[index]) changes.push({ recipientId: row.id, name: row.studentName, workTitle: snapshot.title, before, after: points, taskBefore: oldScores[index], taskAfter: scores[index] });
  }
  const hash = inputHash({ taskId, source: original.hash, target: replacement.hash, versions: versionIds, rows });
  return { impact: { gradingChanged: true, hash, workCount: new Set(affected.map(item => item.row.workId)).size, completedCount: rows.length, changes } satisfies AssessmentCorrectionImpact, updates };
}
