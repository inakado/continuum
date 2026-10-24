import { NotFoundException, Logger } from '@nestjs/common';
import { afterEach, expect, it, vi } from 'vitest';
import { AssessmentDuplicateReadService } from '../src/assessment-bank/assessment-duplicate-read.service';
afterEach(() => vi.restoreAllMocks());
it('degrades advisory lookup failures without changing import state', async () => {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  const prisma = { $transaction: vi.fn().mockRejectedValue(new Error('timeout')) };
  const reads = { previewRecord: vi.fn().mockResolvedValue({ entries: [] }) };
  const service = new AssessmentDuplicateReadService(prisma as never, reads as never);
  expect(await service.hints('teacher', 'preview')).toEqual({ status: 'unavailable', tasks: [] });
  expect(prisma.$transaction).toHaveBeenCalledOnce();
});
it('does not downgrade permission or expiry failures into a misleading completed check', async () => {
  const prisma = { $transaction: vi.fn() };
  const reads = { previewRecord: vi.fn().mockRejectedValue(new NotFoundException()) };
  const service = new AssessmentDuplicateReadService(prisma as never, reads as never);
  await expect(service.hints('other', 'preview')).rejects.toBeInstanceOf(NotFoundException);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
