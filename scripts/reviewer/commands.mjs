import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ReviewerDraftSchema, ReviewerReviewSchema, ReviewerReportSchema, ReviewerPublicationSchema, ReviewerPublicationResultSchema, reviewerPolicy } from '../../packages/shared/src/contracts/reviewer.ts';
import { loadManifest, readJson, saveOperation, sha256, uuid, writeJson } from './client.mjs';

export async function uploadDraft(api, { manifestPath, pdfPath, points, origin, apiPrefix = '/api', operationPath }) {
  const source = await loadManifest(manifestPath, origin, apiPrefix);
  if (points !== null && (!Number.isSafeInteger(points) || points < 0 || points > source.maxPoints)) throw new Error('Баллы должны быть целым числом от 0 до максимума либо null.');
  const info = await stat(pdfPath);
  if (!info.isFile() || info.size > reviewerPolicy.reportMaxBytes) throw new Error('Нужен PDF не больше 20 МиБ.');
  const bytes = await readFile(pdfPath);
  if (bytes.length < 8 || bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Файл не является PDF.');
  const input = { origin, apiPrefix, solutionId: source.id, sourceRevision: source.sourceRevision, expectedReviewRevision: source.review?.revision ?? 0, points, sha256: sha256(bytes) };
  const path = operationPath ?? join(dirname(manifestPath), `draft-${sha256(JSON.stringify(input)).slice(0, 20)}.json`);
  const operation = await saveOperation(path, input);
  // Persist UUIDs before *any* request. Repeating the command replays identical writes.
  await api(`/reviewer/v1/reports/${operation.reportId}`, { method: 'PUT', body: { solutionId: source.id, sourceRevision: source.sourceRevision } });
  const report = ReviewerReportSchema.parse(await api(`/reviewer/v1/reports/${operation.reportId}/file`, { method: 'PUT', body: bytes, contentType: 'application/pdf' }));
  if (!report.ready || report.sha256 !== input.sha256 || report.sizeBytes !== bytes.length) throw new Error('Сервер не подтвердил целостность PDF. Повторите эту же команду.');
  const body = ReviewerDraftSchema.parse({ requestId: operation.requestId, sourceRevision: source.sourceRevision, expectedReviewRevision: input.expectedReviewRevision, points, reportId: operation.reportId });
  const review = ReviewerReviewSchema.parse(await api(`/reviewer/v1/solutions/${source.id}/draft`, { method: 'PUT', body }));
  const publicationItem = { reviewId: review.id, reviewRevision: review.revision, sourceRevision: review.sourceRevision, expectedPublishedRevision: source.publishedRevision };
  await writeJson(path, { ...operation, review, publicationItem });
  return { operationPath: path, review, publicationItem };
}

export async function publish(api, path) {
  const input = ReviewerPublicationSchema.parse(await readJson(path));
  // No implicit selection, no "publish all", no automatic refresh of stale revisions.
  const result = ReviewerPublicationResultSchema.parse(await api('/reviewer/v1/publications', { method: 'POST', body: input }));
  await writeJson(`${path}.receipt.json`, result);
  return result;
}

export async function publicationStatus(api, id) { return ReviewerPublicationResultSchema.parse(await api(`/reviewer/v1/publications/${uuid(id)}`)); }
