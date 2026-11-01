import type { Prisma } from '@prisma/client';

// Shared teaching bank: acquire before work/recipient locks. Transaction-scoped,
// so rollback releases it too. Independent finishes/compositions may run together.
export async function lockAssessmentBank(tx: Prisma.TransactionClient, mode: 'read' | 'write') {
  if (mode === 'write') await tx.$queryRaw`SELECT pg_advisory_xact_lock(1129270868, 1)::text`;
  else await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(1129270868, 1)::text`;
}
