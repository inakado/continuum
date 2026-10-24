import { setTimeout } from 'node:timers/promises';
import { z } from 'zod';

const SqlConflictCode = z.enum(['40001', '40P01']);
const AdapterConflict = z.object({ cause: z.object({ originalCode: SqlConflictCode }) });
const WriteConflict = z.union([
  z.object({ code: z.literal('P2034') }),
  z.object({ code: z.literal('P2010'), meta: z.union([
    z.object({ code: SqlConflictCode }),
    z.object({ driverAdapterError: AdapterConflict }),
  ]) }),
  AdapterConflict,
]);

export const isTransactionWriteConflict = (error: unknown) => WriteConflict.safeParse(error).success;

// Retry the complete transaction, never an individual query in an aborted transaction.
export async function retryTransaction<T>(write: () => Promise<T>, retryable = isTransactionWriteConflict): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await write(); }
    catch (error) {
      if (!retryable(error) || attempt === 4) throw error;
      // Release the connection before backoff; jitter avoids synchronized retries.
      await setTimeout(25 * 2 ** attempt + Math.floor(Math.random() * 25));
    }
  }
}
