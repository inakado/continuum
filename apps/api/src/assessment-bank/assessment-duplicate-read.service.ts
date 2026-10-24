import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AssessmentDuplicateHintsSchema, type AssessmentPackageTask } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentBankReadService } from './assessment-bank-read.service';
import { assessmentPolicy } from './assessment-policy';

type MatchRow = { stable_id: string; location: 'bank' | 'package'; task_id: string | null; candidate_id: string; title: string; version: number; source: AssessmentPackageTask['source']; same_source: boolean; same_statement: boolean };

@Injectable()
export class AssessmentDuplicateReadService {
  private readonly logger = new Logger(AssessmentDuplicateReadService.name);
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AssessmentBankReadService) private readonly reads: AssessmentBankReadService) {}

  async hints(teacherId: string, previewId: string) {
    // Permissions and TTL errors remain real errors; only advisory lookup can degrade.
    const { entries } = await this.reads.previewRecord(teacherId, previewId);
    const input = entries.map(({ task, statement }) => ({ stable_id: task.id, title: task.title, source: task.source, statement }));
    try {
      const rows = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('statement_timeout', ${String(assessmentPolicy.duplicateTimeoutMs)}, true)`;
        return tx.$queryRaw<MatchRow[]>(assessmentDuplicateQuery(teacherId, input));
      }, { timeout: assessmentPolicy.duplicateTimeoutMs + 1000 });
      return this.result(rows);
    } catch {
      this.logger.warn('Duplicate hints unavailable; import remains permitted.');
      return AssessmentDuplicateHintsSchema.parse({ status: 'unavailable', tasks: [] });
    }
  }

  private result(rows: MatchRow[]) {
    const grouped = new Map<string, MatchRow[]>();
    for (const row of rows) grouped.set(row.stable_id, [...(grouped.get(row.stable_id) ?? []), row]);
    return AssessmentDuplicateHintsSchema.parse({ status: 'complete', tasks: [...grouped].map(([stableId, matches]) => ({
      stableId, hasMore: matches.length > assessmentPolicy.duplicateMatches,
      matches: matches.slice(0, assessmentPolicy.duplicateMatches).map((row) => ({
        target: { location: row.location, ...(row.location === 'bank' ? { taskId: row.task_id } : {}), stableId: row.candidate_id, title: row.title, version: row.version, source: row.source },
        reasons: [...(row.same_source ? ['source'] : []), ...(row.same_statement ? ['statement'] : [])],
      })),
    })) });
  }
}

export type DuplicateInput = { stable_id: string; title: string; source: AssessmentPackageTask['source']; statement: string };
export function assessmentDuplicateQuery(teacherId: string, input: DuplicateInput[]) {
  return Prisma.sql`
          WITH normalized AS MATERIALIZED (
            SELECT stable_id, title, source,
              lower(btrim(normalize(source->>'provider', NFC))) AS provider,
              nullif(lower(btrim(normalize(source->>'externalId', NFC))), '') AS external_id,
              btrim(regexp_replace(normalize(statement, NFC), '[[:space:]]+', ' ', 'g')) AS statement
            FROM jsonb_to_recordset(${JSON.stringify(input)}::jsonb) AS x(stable_id text, title text, source jsonb, statement text)
          ), inputs AS MATERIALIZED (SELECT *, md5(statement) AS statement_hash FROM normalized)
          SELECT i.stable_id, hit.* FROM inputs i CROSS JOIN LATERAL (
            SELECT * FROM (
              (SELECT 'bank'::text AS location, b.id::text AS task_id, b.stable_id AS candidate_id, v.title, v.version, v.data#>'{task,source}' AS source,
                (lower(btrim(normalize(v.data#>>'{task,source,provider}', NFC))) = i.provider AND lower(btrim(normalize(v.data#>>'{task,source,externalId}', NFC))) = i.external_id) IS TRUE AS same_source,
                btrim(regexp_replace(normalize(v.data->>'statement', NFC), '[[:space:]]+', ' ', 'g')) = i.statement AS same_statement
              FROM assessment_task_versions v JOIN assessment_bank_tasks b ON b.latest_version_id = v.id
              WHERE b.teacher_id = ${teacherId}::uuid AND b.deleted_at IS NULL AND b.stable_id <> i.stable_id
                AND ((lower(btrim(normalize(v.data#>>'{task,source,provider}', NFC))) = i.provider AND lower(btrim(normalize(v.data#>>'{task,source,externalId}', NFC))) = i.external_id)
                  OR (md5(btrim(regexp_replace(normalize(v.data->>'statement', NFC), '[[:space:]]+', ' ', 'g'))) = i.statement_hash
                    AND btrim(regexp_replace(normalize(v.data->>'statement', NFC), '[[:space:]]+', ' ', 'g')) = i.statement))
              ORDER BY b.stable_id LIMIT ${assessmentPolicy.duplicateMatches + 1})
              UNION ALL
              (SELECT 'package'::text, NULL::text, c.stable_id, c.title, 1, c.source,
                (c.provider = i.provider AND c.external_id = i.external_id) IS TRUE, c.statement = i.statement
              FROM inputs c WHERE c.stable_id <> i.stable_id AND ((c.provider = i.provider AND c.external_id = i.external_id) OR (c.statement_hash = i.statement_hash AND c.statement = i.statement))
              ORDER BY c.stable_id LIMIT ${assessmentPolicy.duplicateMatches + 1})
            ) candidates ORDER BY location, candidate_id LIMIT ${assessmentPolicy.duplicateMatches + 1}
          ) hit ORDER BY i.stable_id, hit.location, hit.candidate_id`;
}
