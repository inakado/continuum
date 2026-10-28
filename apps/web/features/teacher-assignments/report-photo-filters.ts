import { z } from 'zod';
import type { WorkProgress } from '@continuum/shared';

export const photoFilterSchema = z.enum(['all', 'none', 'partial', 'uploaded', 'awaiting_review', 'published']);
export type PhotoFilter = z.infer<typeof photoFilterSchema>;
export const photoFilters: { id: PhotoFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'none', label: 'Нет решений' },
  { id: 'partial', label: 'Часть решений' },
  { id: 'uploaded', label: 'Все решения' },
  { id: 'awaiting_review', label: 'Ожидают проверки' },
  { id: 'published', label: 'Проверены' },
];

export function matchesPhotoFilter(progress: WorkProgress, total: number, filter: PhotoFilter) {
  if (filter === 'all' || total === 0) return true;
  const { photoTaskCount: photos, publishedReviewTaskCount: reviews } = progress;
  switch (filter) {
    case 'none': return photos === 0;
    case 'partial': return photos > 0 && photos < total;
    case 'uploaded': return photos === total;
    case 'awaiting_review': return photos > reviews;
    case 'published': return reviews === total;
  }
}
