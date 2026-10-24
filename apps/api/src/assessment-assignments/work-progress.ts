import type { Prisma } from '@prisma/client';
import type { WorkProgress } from '@continuum/shared';
import type { WorkSnapshot } from './assignment-data';

export function progressScope(row: { id: string; completedAt: Date | null }, snapshot: WorkSnapshot) {
  const extendedTaskIds = snapshot.items.filter((item) => item.data.task.type === 'extended').map((item) => item.taskId);
  return { id: row.id, completedAt: row.completedAt, automaticTaskCount: snapshot.items.length - extendedTaskIds.length, extendedTaskIds };
}

export async function readWorkProgress(db: Prisma.TransactionClient, scopes: ReturnType<typeof progressScope>[]): Promise<Map<string, WorkProgress>> {
  const extended = scopes.filter((row) => row.extendedTaskIds.length > 0);
  const answers = extended.length ? await db.assessmentSolutionAnswer.findMany({ where: { recipientId: { in: extended.map((row) => row.id) } }, select: {
    id: true, recipientId: true, taskId: true, revision: true,
    _count: { select: { photos: { where: { confirmedAt: { not: null }, removedAt: null } } } },
    review: { select: { id: true, publishedRevision: true } },
  } }) : [];
  const publishedRefs = answers.flatMap((answer) => answer.review?.publishedRevision != null ? [{ reviewId: answer.review.id, revision: answer.review.publishedRevision }] : []);
  const versions = publishedRefs.length ? await db.assessmentReviewVersion.findMany({ where: { OR: publishedRefs }, select: {
    reviewId: true, revision: true, sourceRevision: true, points: true,
    report: { select: { solutionId: true, sourceRevision: true, confirmedAt: true } },
  } }) : [];
  const published = new Map(versions.map((version) => [`${version.reviewId}:${version.revision}`, version]));
  const byRecipient = new Map<string, typeof answers>();
  for (const answer of answers) {
    const entries = byRecipient.get(answer.recipientId) ?? [];
    entries.push(answer); byRecipient.set(answer.recipientId, entries);
  }
  return new Map(scopes.map((scope) => {
    const tasks = new Set(scope.extendedTaskIds);
    let photoTaskCount = 0, publishedReviewTaskCount = 0;
    for (const answer of byRecipient.get(scope.id) ?? []) {
      if (!tasks.has(answer.taskId)) continue;
      if (answer._count.photos > 0) photoTaskCount++;
      const version = published.get(`${answer.review?.id}:${answer.review?.publishedRevision}`);
      if (version && version.points !== null && version.sourceRevision === answer.revision && version.report?.confirmedAt && version.report.solutionId === answer.id && version.report.sourceRevision === answer.revision) publishedReviewTaskCount++;
    }
    return [scope.id, { photoTaskCount, publishedReviewTaskCount, resultReady: (scope.automaticTaskCount === 0 || scope.completedAt !== null) && publishedReviewTaskCount === tasks.size }];
  }));
}
