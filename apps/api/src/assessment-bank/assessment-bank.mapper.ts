import { z } from 'zod';
import { AssessmentPackageTaskSchema, type AssessmentTaskSummary, type AssessmentTaskView } from '@continuum/shared';

export const StoredAssessmentTaskSchema = z.object({
  task: AssessmentPackageTaskSchema,
  statement: z.string(), solution: z.string().nullable(), hash: z.string(),
  images: z.array(z.object({ path: z.string(), key: z.string(), hash: z.string(), contentType: z.string() })),
});
export const StoredAssessmentImportSchema = z.array(StoredAssessmentTaskSchema);
export type StoredAssessmentTask = z.infer<typeof StoredAssessmentTaskSchema>;
export const BaselineSchema = z.record(z.string(), z.string().nullable());

export function assessmentBaseline(hash: string | undefined, deletedAt?: Date | null) {
  return hash ? (deletedAt ? `deleted:${deletedAt.toISOString()}:${hash}` : hash) : null;
}

export function mapAssessmentSummary(id: string, version: number, data: StoredAssessmentTask): AssessmentTaskSummary {
  const { task } = data;
  return { id, stableId: task.id, title: task.title, gradeBand: task.gradeBand, topicPath: task.topicPath, type: task.type, maxPoints: task.maxPoints, source: task.source, version,
    excerpt: data.statement.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, '…').replace(/\s+/g, ' ').slice(0, 160) };
}
export function mapAssessmentView(id: string, version: number, data: StoredAssessmentTask, imageBase: string): AssessmentTaskView {
  return { id, version, task: data.task, statement: data.statement, solution: data.solution,
    images: Object.fromEntries(data.images.map((image) => [image.path, `${imageBase}/${encodeURIComponent(image.path.slice('images/'.length))}?version=${version}`])) };
}
