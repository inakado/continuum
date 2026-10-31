import { realpath, unlink, lstat, readFile, readdir, rmdir } from 'node:fs/promises';
import { join, dirname, basename, sep } from 'node:path';
import { ReviewerSolutionSchema, ReviewerReviewSchema, ReviewerPublicationResultSchema } from '../../packages/shared/src/contracts/reviewer.ts';
import { readJson, sha256, writeJson } from './client.mjs';

// Only a managed job with a matching published revision can lose its local files.
export async function cleanupReviewed({ root, directory, operationPath, pdfPath, publication }) {
  const base = await realpath(root), job = await realpath(directory);
  const inside = path => path.startsWith(job + sep);
  if ((await lstat(directory)).isSymbolicLink() || !job.startsWith(base + sep)) throw new Error('Очистка разрешена только внутри управляемой папки проверок.');
  if (!inside(await realpath(operationPath))) throw new Error('Файл операции находится вне папки проверки.');
  const pdf = join(await realpath(dirname(pdfPath)), basename(pdfPath));
  if (!inside(pdf)) throw new Error('PDF находится вне папки проверки.');
  const marker = await readJson(join(job, 'managed.json'));
  if (marker.owner !== 'continuum-reviewer-pilot-v1') throw new Error('Это не управляемая папка проверки.');
  const manifest = await readJson(join(job, 'source.json')), source = ReviewerSolutionSchema.parse(manifest.source);
  const operation = await readJson(operationPath), input = operation.input, review = operation.review;
  if (marker.solutionId !== source.id || marker.sourceRevision !== source.sourceRevision || input?.solutionId !== source.id || input.sourceRevision !== source.sourceRevision || !review?.reportId || review.reportId !== operation.reportId || review.sourceRevision !== source.sourceRevision || review.points !== input.points || !/^[a-f0-9]{64}$/.test(input.sha256)) throw new Error('Нет подтверждённой загрузки именно этого PDF и набора фото. Файлы сохранены.');
  ReviewerReviewSchema.parse(review);
  const published = ReviewerPublicationResultSchema.parse(publication);
  if (!published.items.some(item => item.solutionId === source.id && item.reviewId === review.id && item.reviewRevision === review.revision && item.points === review.points)) throw new Error('Нет подтверждённой публикации именно этой ревизии. Файлы сохранены.');
  const candidates = [...manifest.photos, ...manifest.images].map(item => {
    if (!/^(photos|images)\/[A-Za-z0-9_./-]+$/.test(item.path) || item.path.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Небезопасный путь очистки.');
    return { path: join(job, item.path), hash: item.sha256 };
  }).concat({ path: pdf, hash: input.sha256 });
  if (marker.evaluationHash) candidates.push({ path: join(job, 'evaluation.json'), hash: marker.evaluationHash });
  const builds = [];
  for (const entry of await readdir(job, { withFileTypes: true })) {
    if (!entry.name.startsWith('.review-build-')) continue;
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Небезопасная папка TeX.');
    const directory = join(job, entry.name), files = await readdir(directory, { withFileTypes: true });
    if (files.some(file => !file.isFile() || file.isSymbolicLink() || !/^review\.(tex|aux|log|pdf|out|fls|fdb_latexmk|synctex\.gz)$/.test(file.name))) throw new Error('Посторонние файлы в папке TeX. Файлы сохранены.');
    for (const file of files) {
      const path = join(directory, file.name);
      candidates.push({ path, hash: sha256(await readFile(path)) });
    }
    builds.push(directory);
  }
  const remaining = [];
  for (const item of candidates) {
    try {
      const path = await realpath(item.path);
      if (!inside(path) || (await lstat(item.path)).isSymbolicLink()) throw new Error('Небезопасный путь очистки.');
      if (sha256(await readFile(path)) !== item.hash) throw new Error('Локальный файл изменился. Файлы сохранены.');
      remaining.push(path);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const receiptPath = join(job, 'receipt.json');
  await writeJson(receiptPath, { version: 1, solutionId: source.id, sourceRevision: source.sourceRevision, review, publicationId: published.id, publishedAt: published.publishedAt, pdfSha256: input.sha256, cleanedAt: new Date().toISOString() });
  for (const path of remaining) await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
  for (const directory of builds) await rmdir(directory).catch(error => { if (error.code !== 'ENOENT') throw error; });
  return { removedFiles: remaining.length, receiptPath };
}

// Only the exact solutions in this confirmed publication, under this profile/site root.
export async function cleanupPublished({ root, origin, apiPrefix = '/api', publication }) {
  const result = ReviewerPublicationResultSchema.parse(publication), cleaned = [], retained = [];
  for (const item of result.items) {
    const parent = join(root, item.solutionId);
    let jobs;
    try {
      if ((await lstat(parent)).isSymbolicLink()) throw new Error('Небезопасная папка решения.');
      jobs = await readdir(parent, { withFileTypes: true });
    } catch (error) {
      if (error.code !== 'ENOENT') retained.push({ solutionId: item.solutionId, reason: 'Папка решения недоступна для безопасной очистки.' });
      continue;
    }
    for (const job of jobs) {
      if (!job.isDirectory() || job.isSymbolicLink()) continue;
      const directory = join(parent, job.name);
      try {
        const marker = await readJson(join(directory, 'managed.json'));
        if (marker.owner !== 'continuum-reviewer-pilot-v1' || !marker.operation || !marker.pdf) continue;
        const local = value => {
          if (typeof value !== 'string' || value.startsWith('/') || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Небезопасный путь.');
          return join(directory, value);
        };
        const manifest = await readJson(join(directory, 'source.json'));
        if (manifest.origin !== origin || manifest.apiPrefix !== apiPrefix || manifest.source?.id !== item.solutionId) continue;
        const operationPath = local(marker.operation), operation = await readJson(operationPath);
        // A later draft of the same solution must survive publication of an older review.
        if (operation.review?.id !== item.reviewId || operation.review?.revision !== item.reviewRevision) continue;
        cleaned.push(await cleanupReviewed({ root, directory, operationPath, pdfPath: local(marker.pdf), publication: result }));
      } catch {
        retained.push({ solutionId: item.solutionId, reason: 'Локальные файлы сохранены: проверка очистки не пройдена. Повторите publish --request с ID публикации.' });
      }
    }
  }
  return { cleaned, retained };
}
