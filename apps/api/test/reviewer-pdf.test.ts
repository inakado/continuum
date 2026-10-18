import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { reviewerPolicy } from '@continuum/shared';
import { readReviewPdf } from '../src/reviewer/reviewer-pdf';

it('accepts complete PDF bytes and preserves their hash', async () => {
  const bytes = Buffer.from('%PDF-1.7\ncontent\n%%EOF\n');
  await expect(readReviewPdf(Readable.from([bytes.subarray(0, 4), bytes.subarray(4)]), 'application/pdf')).resolves.toEqual({ bytes, sizeBytes: bytes.length, contentHash: createHash('sha256').update(bytes).digest('hex') });
});
it('rejects wrong type, incomplete content and an oversized stream without trusting Content-Length', async () => {
  await expect(readReviewPdf(Readable.from(['%PDF-1.7\n%%EOF']), 'text/html')).rejects.toMatchObject({ status: 400 });
  await expect(readReviewPdf(Readable.from(['%PDF-1.7\nunclosed']), 'application/pdf')).rejects.toMatchObject({ status: 400 });
  await expect(readReviewPdf(Readable.from([Buffer.alloc(reviewerPolicy.reportMaxBytes + 1)]), 'application/pdf', '1')).rejects.toMatchObject({ status: 413 });
  await expect(readReviewPdf(Readable.from([]), 'application/pdf', String(reviewerPolicy.reportMaxBytes + 1))).rejects.toMatchObject({ status: 413 });
});
