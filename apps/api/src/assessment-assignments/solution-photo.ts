import { BadRequestException } from '@nestjs/common';
import { imageSize } from 'image-size';
import { solutionPhotoPolicy } from '@continuum/shared';
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

export async function readSolutionPhoto(stream: Readable, contentType: string, contentLength?: string) {
  if (!solutionPhotoPolicy.contentTypes.some((type) => type === contentType)) throw new BadRequestException('Выберите фото в формате JPG, PNG или WebP.');
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > solutionPhotoPolicy.maxBytes)) throw new BadRequestException('Фотография превышает 10 МБ.');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > solutionPhotoPolicy.maxBytes) throw new BadRequestException('Фотография превышает 10 МБ.');
    chunks.push(Buffer.from(chunk));
  }
  if (!size || (contentLength && Number(contentLength) !== size)) throw new BadRequestException('Загрузка фотографии не завершена.');
  const bytes = Buffer.concat(chunks);
  try {
    const image = imageSize(bytes);
    const type = `image/${image.type === 'jpg' ? 'jpeg' : image.type}`;
    if (type !== contentType || !image.width || !image.height || image.width * image.height > solutionPhotoPolicy.maxPixels) throw new Error();
  } catch { throw new BadRequestException('Не удалось прочитать фотографию. Проверьте формат и размер изображения.'); }
  return { bytes, contentType, sizeBytes: size, contentHash: createHash('sha256').update(bytes).digest('hex') };
}
