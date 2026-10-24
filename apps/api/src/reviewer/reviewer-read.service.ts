import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Readable } from 'node:stream';
import type { ReviewerListQuery } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';
import { ReviewerAuthService, unavailable, type ReviewerPrincipal } from './reviewer-auth.service';

export const solutionInclude = Prisma.validator<Prisma.AssessmentSolutionAnswerInclude>()({ recipient: { include: { version: true } }, photos: { where: { confirmedAt: { not: null }, removedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }, review: { include: { versions: { orderBy: { revision: 'desc' }, take: 1 } } } });
export type SolutionRow = Prisma.AssessmentSolutionAnswerGetPayload<{ include: typeof solutionInclude }>;
function solutionState(row: Pick<SolutionRow, 'revision' | 'review'>) {
  if (row.review?.versions[0]?.sourceRevision !== undefined && row.review.versions[0].sourceRevision !== row.revision) return 'stale';
  if (row.review?.publishedRevision && row.review.publishedRevision === row.review.revision) return 'published';
  return row.review?.versions.length ? 'draft' : 'unreviewed';
}
export function latestReview(row: Pick<SolutionRow, 'review'>) {
  const version = row.review?.versions[0];
  return version && row.review ? { id: row.review.id, revision: version.revision, sourceRevision: version.sourceRevision, points: version.points, reportId: version.reportId, authorUserId: version.authorUserId, savedAt: version.createdAt.toISOString() } : null;
}
export function solutionTask(row: SolutionRow) {
  const snapshot = WorkSnapshotSchema.parse(row.recipient.version.data);
  const number = snapshot.items.findIndex((item) => item.taskId === row.taskId);
  const item = snapshot.items[number];
  if (item?.data.task.type !== 'extended') throw unavailable();
  return { item, number: number + 1 };
}
@Injectable()
export class ReviewerReadService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(ReviewerAuthService) private readonly auth: ReviewerAuthService, @Inject(ObjectStorageService) private readonly storage: ObjectStorageService) {}
  async assignments(principal: ReviewerPrincipal, query: ReviewerListQuery) {
    const rows = await this.db.assessmentAssignment.findMany({ where: { ...(query.cursor ? { id: { gt: query.cursor } } : {}), recipients: { some: this.auth.recipients(principal) }, ...(query.query ? { OR: [{ classTitle: { contains: query.query, mode: 'insensitive' } }, { version: { data: { path: ['title'], string_contains: query.query, mode: 'insensitive' } } }] } : {}) }, include: { version: { include: { work: true } } }, orderBy: { id: 'asc' }, take: query.limit + 1 });
    const shown = rows.slice(0, query.limit);
    return { items: shown.map((row) => ({ id: row.id, versionId: row.versionId, title: WorkSnapshotSchema.parse(row.version.data).title, version: row.version.number, classTitle: row.classTitle, academicYear: row.academicYear, owner: row.version.work.teacherId === principal.userId, canPublish: principal.scopes.includes('publish') })), nextCursor: rows.length > query.limit ? shown[shown.length - 1].id : null };
  }
  async owned(principal: ReviewerPrincipal, id: string, scope: 'read' | 'draft:write' | 'publish' = 'read', tx: Prisma.TransactionClient = this.db) {
    const row = await tx.assessmentSolutionAnswer.findFirst({ where: { id, recipient: this.auth.recipients(principal) }, include: solutionInclude });
    if (!row) throw unavailable();
    await this.auth.assignment(principal, row.recipient.assignmentId, scope, tx);
    return row;
  }
  async list(principal: ReviewerPrincipal, assignmentId: string, query: ReviewerListQuery) {
    const assignment = await this.auth.assignment(principal, assignmentId, 'read');
    const tasks = new Map(WorkSnapshotSchema.parse(assignment.version.data).items.map((item) => [item.taskId, item.data.task]));
    const items = [];
    let cursor = query.cursor;
    while (items.length <= query.limit) {
      const rows = await this.db.assessmentSolutionAnswer.findMany({ where: { recipient: { assignmentId, ...this.auth.recipients(principal) }, ...(cursor ? { id: { gt: cursor } } : {}), photos: { some: { confirmedAt: { not: null }, removedAt: null } } }, include: { recipient: { select: { studentName: true } }, _count: { select: { photos: { where: { confirmedAt: { not: null }, removedAt: null } } } }, review: { include: { versions: { orderBy: { revision: 'desc' }, take: 1 } } } }, orderBy: { id: 'asc' }, take: query.limit + 1 });
      if (!rows.length) break;
      for (const row of rows) {
        const review = latestReview(row);
        const state = solutionState(row);
        const task = tasks.get(row.taskId);
        if (task?.type !== 'extended') throw unavailable();
        if (!query.state || state === query.state) items.push({ id: row.id, recipientId: row.recipientId, taskId: row.taskId, studentName: row.recipient.studentName, title: task.title, sourceRevision: row.revision, photoCount: row._count.photos, state, review, publishedRevision: row.review?.publishedRevision ?? null });
        cursor = row.id;
        if (items.length > query.limit) break;
      }
      if (items.length > query.limit || rows.length < query.limit + 1) break;
    }
    const shown = items.slice(0, query.limit);
    return { items: shown, nextCursor: items.length > query.limit ? shown[shown.length - 1].id : null };
  }
  async detail(principal: ReviewerPrincipal, id: string) {
    const row = await this.owned(principal, id);
    const { item, number } = solutionTask(row);
    return { id, assignmentId: row.recipient.assignmentId, recipientId: row.recipientId, versionId: row.recipient.versionId, taskId: row.taskId, number, title: item.data.task.title, statement: item.data.statement, maxPoints: item.data.task.maxPoints, source: `${item.data.task.source.provider}${item.data.task.source.externalId ? ` №${item.data.task.source.externalId}` : ''}`, sourceRevision: row.revision, locked: Boolean(row.lockedAt), review: latestReview(row), publishedRevision: row.review?.publishedRevision ?? null,
      photos: row.photos.map((photo) => ({ id: photo.id, contentType: photo.contentType, sizeBytes: photo.sizeBytes, sha256: photo.contentHash, downloadPath: `/reviewer/v1/solutions/${id}/photos/${photo.id}?sourceRevision=${row.revision}` })),
      images: item.data.images.map((image) => ({ name: image.path, downloadPath: `/reviewer/v1/solutions/${id}/images/${encodeURIComponent(image.path.slice('images/'.length))}` })) };
  }
  async photo(principal: ReviewerPrincipal, id: string, photoId: string, revision: number) {
    const row = await this.owned(principal, id);
    if (row.revision !== revision) throw new ConflictException({ code: 'SOURCE_REVISION_CONFLICT', message: 'Фотографии изменились. Получите решение заново.' });
    const photo = row.photos.find((item) => item.id === photoId);
    if (!photo) throw unavailable();
    return this.stream(photo.objectKey, photo.contentType);
  }
  async image(principal: ReviewerPrincipal, id: string, name: string) {
    const row = await this.owned(principal, id);
    const image = solutionTask(row).item.data.images.find((item) => item.path === `images/${name}`);
    if (!image) throw unavailable();
    return this.stream(image.key, image.contentType);
  }
  async report(principal: ReviewerPrincipal, id: string) {
    const report = await this.db.assessmentReviewReport.findUnique({ where: { id } });
    if (!report?.confirmedAt) throw unavailable();
    await this.owned(principal, report.solutionId);
    return this.stream(report.objectKey, 'application/pdf');
  }
  async stream(key: string, contentType: string) {
    const object = await this.storage.getObjectStream(key);
    if (!(object.stream instanceof Readable)) throw new Error('Unsupported storage stream');
    return { stream: object.stream, contentType };
  }
}
