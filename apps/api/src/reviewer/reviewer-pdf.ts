import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { reviewerPolicy } from '@continuum/shared';
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

export async function readReviewPdf(stream: Readable, type: string, length?: string) {
  if (type.split(';')[0].trim() !== 'application/pdf') throw new BadRequestException('Загрузите PDF-файл.');
  if (length && (!/^\d+$/.test(length) || Number(length) > reviewerPolicy.reportMaxBytes)) throw new PayloadTooLargeException('PDF больше 20 МиБ.');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > reviewerPolicy.reportMaxBytes) throw new PayloadTooLargeException('PDF больше 20 МиБ.');
    chunks.push(bytes);
  }
  const bytes = Buffer.concat(chunks);
  if (!bytes.subarray(0, 8).toString('ascii').match(/^%PDF-1\.[0-9]|^%PDF-2\.0/) || !bytes.subarray(-1024).toString('ascii').includes('%%EOF')) throw new BadRequestException('Файл не похож на завершённый PDF.');
  return { bytes, sizeBytes: size, contentHash: createHash('sha256').update(bytes).digest('hex') };
}
