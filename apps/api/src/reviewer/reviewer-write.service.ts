import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { ReviewerPublicationResultSchema, type ReviewerDraft, type ReviewerPublication, type ReviewerReportCreate } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { ReviewerAuthService, unavailable, type ReviewerPrincipal } from './reviewer-auth.service';
import { latestReview, ReviewerReadService, solutionTask, type SolutionRow } from './reviewer-read.service';
import { readReviewPdf } from './reviewer-pdf';

const conflict = (code: string, message: string) => new ConflictException({ code, message });
const hash = (input: object) => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const reportDTO = (row: { id: string; solutionId: string; sourceRevision: number; confirmedAt: Date | null; contentHash: string | null; sizeBytes: number | null }) => ({ id: row.id, solutionId: row.solutionId, sourceRevision: row.sourceRevision, ready: Boolean(row.confirmedAt), sha256: row.contentHash, sizeBytes: row.sizeBytes });

@Injectable()
export class ReviewerWriteService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(ReviewerAuthService) private readonly auth: ReviewerAuthService, @Inject(ReviewerReadService) private readonly reads: ReviewerReadService, @Inject(ObjectStorageService) private readonly storage: ObjectStorageService) {}
  private async lock(principal: ReviewerPrincipal, ids: string[], scope: 'draft:write' | 'publish', tx: Prisma.TransactionClient) {
    await this.auth.lockPrincipal(principal, scope, tx);
    const initial = await Promise.all(ids.map((id) => this.reads.owned(principal, id, scope, tx)));
    const recipients = [...new Set(initial.map((row) => row.recipientId))].sort();
    for (const id of recipients) await tx.$queryRaw`SELECT id FROM assessment_recipients WHERE id = ${id}::uuid FOR UPDATE`;
    for (const id of [...new Set(initial.map((row) => row.recipient.studentId).filter((id): id is string => id !== null))].sort()) {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT user_id FROM student_profiles WHERE user_id = ${id}::uuid FOR SHARE`;
    }
    return Promise.all(ids.map((id) => this.reads.owned(principal, id, scope, tx)));
  }
  private source(row: SolutionRow, revision: number) {
    if (row.revision !== revision || !row.photos.length) throw conflict('SOURCE_REVISION_CONFLICT', 'Фотографии изменились или удалены. Получите решение заново.');
  }
  private async replay(principal: ReviewerPrincipal, requestId: string, route: string, input: object, tx: Prisma.TransactionClient) {
    const receipt = await tx.reviewerWriteReceipt.findUnique({ where: { id: requestId } });
    if (!receipt) return null;
    if (receipt.userId !== principal.userId || receipt.route !== route || receipt.inputHash !== hash(input)) throw conflict('REQUEST_ID_REUSED', 'Идентификатор запроса уже использован с другими данными.');
    return receipt.result;
  }
  private async receipt(principal: ReviewerPrincipal, id: string, assignmentId: string, route: string, input: object, result: Prisma.InputJsonValue, tx: Prisma.TransactionClient) {
    await tx.reviewerWriteReceipt.create({ data: { id, userId: principal.userId, keyId: principal.keyId, assignmentId, route, inputHash: hash(input), result } });
  }
  async reserveReport(principal: ReviewerPrincipal, id: string, input: ReviewerReportCreate) {
    return this.db.$transaction(async (tx) => {
      const [row] = await this.lock(principal, [input.solutionId], 'draft:write', tx);
      this.source(row, input.sourceRevision);
      const previous = await tx.assessmentReviewReport.findUnique({ where: { id } });
      if (previous) {
        if (previous.solutionId !== row.id || previous.sourceRevision !== input.sourceRevision || previous.uploaderId !== principal.userId) throw conflict('REQUEST_ID_REUSED', 'Идентификатор отчёта уже используется.');
        return reportDTO(previous);
      }
      const report = await tx.assessmentReviewReport.create({ data: { id, solutionId: row.id, sourceRevision: row.revision, uploaderId: principal.userId, objectKey: `assessment-reviews/${row.id}/${id}.pdf` } });
      return reportDTO(report);
    });
  }
  async uploadReport(principal: ReviewerPrincipal, id: string, stream: Readable, type: string, length?: string) {
    const report = await this.db.assessmentReviewReport.findUnique({ where: { id } });
    if (!report || report.uploaderId !== principal.userId) throw unavailable();
    await this.reads.owned(principal, report.solutionId, 'draft:write');
    const pdf = await readReviewPdf(stream, type, length);
    return this.db.$transaction(async (tx) => {
      const [row] = await this.lock(principal, [report.solutionId], 'draft:write', tx);
      const current = await tx.assessmentReviewReport.findUniqueOrThrow({ where: { id } });
      if (current.confirmedAt) {
        if (current.contentHash !== pdf.contentHash) throw conflict('REPORT_IMMUTABLE', 'Отчёт уже загружен. Для другого PDF создайте новый идентификатор.');
        return reportDTO(current);
      }
      this.source(row, current.sourceRevision);
      await this.storage.putObject({ key: current.objectKey, body: pdf.bytes, contentType: 'application/pdf', cacheControl: 'private, no-store' });
      return reportDTO(await tx.assessmentReviewReport.update({ where: { id }, data: { contentHash: pdf.contentHash, sizeBytes: pdf.sizeBytes, confirmedAt: new Date() } }));
    }, { timeout: 30000 });
  }
  async draft(principal: ReviewerPrincipal, id: string, input: ReviewerDraft) {
    return this.db.$transaction(async (tx) => {
      const [row] = await this.lock(principal, [id], 'draft:write', tx);
      const route = `draft:${id}`;
      const replay = await this.replay(principal, input.requestId, route, input, tx);
      if (replay) return replay;
      this.source(row, input.sourceRevision);
      if ((row.review?.revision ?? 0) !== input.expectedReviewRevision) throw conflict('REVIEW_REVISION_CONFLICT', 'Рецензия изменена другим проверяющим. Получите актуальную версию.');
      if (input.points !== null && input.points > solutionTask(row).item.data.task.maxPoints) throw new BadRequestException({ code: 'POINTS_INVALID', message: 'Баллы превышают максимум задачи.' });
      if (input.reportId) {
        const report = await tx.assessmentReviewReport.findFirst({ where: { id: input.reportId, solutionId: id, sourceRevision: row.revision, confirmedAt: { not: null } } });
        if (!report) throw conflict('REPORT_NOT_READY', 'PDF не загружен или относится к другому решению.');
      }
      const review = await tx.assessmentReview.upsert({ where: { solutionId: id }, create: { solutionId: id, revision: 1 }, update: { revision: { increment: 1 } } });
      const version = await tx.assessmentReviewVersion.create({ data: { reviewId: review.id, revision: review.revision, sourceRevision: row.revision, points: input.points, reportId: input.reportId, authorUserId: principal.userId, keyId: principal.keyId } });
      const result = { id: review.id, revision: version.revision, sourceRevision: version.sourceRevision, points: version.points, reportId: version.reportId, authorUserId: version.authorUserId, savedAt: version.createdAt.toISOString() };
      await this.receipt(principal, input.requestId, row.recipient.assignmentId, route, input, result, tx);
      return result;
    });
  }
  async publish(principal: ReviewerPrincipal, input: ReviewerPublication) {
    const reviews = await this.db.assessmentReview.findMany({ where: { id: { in: input.items.map((item) => item.reviewId) } } });
    if (reviews.length !== input.items.length) throw unavailable();
    return this.db.$transaction(async (tx) => {
      const rows = await this.lock(principal, reviews.map((review) => review.solutionId).sort(), 'publish', tx);
      const assignmentId = rows[0].recipient.assignmentId;
      if (rows.some((row) => row.recipient.assignmentId !== assignmentId)) throw new BadRequestException('Публикуйте назначения отдельными запросами.');
      const replay = await this.replay(principal, input.requestId, 'publish', input, tx);
      if (replay) return ReviewerPublicationResultSchema.parse(replay);
      const items = [];
      for (const item of input.items) {
        const row = rows.find((entry) => entry.review?.id === item.reviewId)!;
        this.source(row, item.sourceRevision);
        const review = latestReview(row);
        if (!review || review.revision !== item.reviewRevision || review.sourceRevision !== row.revision || row.review!.publishedRevision !== item.expectedPublishedRevision) throw conflict('REVIEW_REVISION_CONFLICT', 'Рецензия или опубликованный результат изменились. Перечитайте выбранную пачку.');
        if (review.points === null || !review.reportId) throw conflict('REVIEW_INCOMPLETE', 'Для публикации нужны баллы и PDF-разбор каждой задачи.');
        const report = await tx.assessmentReviewReport.findFirst({ where: { id: review.reportId, solutionId: row.id, sourceRevision: row.revision, confirmedAt: { not: null } } });
        if (!report) throw conflict('REPORT_NOT_READY', 'Нет готового PDF для актуальных фотографий.');
        await tx.assessmentReview.update({ where: { id: review.id }, data: { publishedRevision: review.revision } });
        await tx.assessmentSolutionAnswer.update({ where: { id: row.id }, data: { lockedAt: row.lockedAt ?? new Date() } });
        items.push({ reviewId: review.id, reviewRevision: review.revision, solutionId: row.id, points: review.points });
      }
      const result = { id: input.requestId, publishedAt: new Date().toISOString(), items };
      await this.receipt(principal, input.requestId, assignmentId, 'publish', input, result, tx);
      return result;
    });
  }
  async publication(principal: ReviewerPrincipal, id: string) {
    const row = await this.db.reviewerWriteReceipt.findFirst({ where: { id, route: 'publish' } });
    if (!row) throw unavailable();
    const result = ReviewerPublicationResultSchema.parse(row.result);
    await Promise.all(result.items.map((item) => this.reads.owned(principal, item.solutionId)));
    return result;
  }
}
