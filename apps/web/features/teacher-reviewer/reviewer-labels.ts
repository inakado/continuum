import type { ReviewerKey, ReviewerTargets } from '@continuum/shared';

export const classLabel = (item: ReviewerTargets['classes'][number]) => `${item.title} · ${item.academicYear}–${item.academicYear + 1}${item.isArchived ? ' · Архив' : ''}`;
export const accessDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
export const keyStatus = (key: ReviewerKey) => key.revokedAt ? 'Ключ отозван' : key.expiresAt === null ? 'Действует до отзыва' : new Date(key.expiresAt).getTime() <= Date.now() ? 'Срок ключа истёк' : `Действует до ${accessDate(key.expiresAt)}`;

export function targetSummary(key: ReviewerKey, targets?: ReviewerTargets) {
  if (!key.classIds.length && !key.studentIds.length) return 'Прежний доступ больше не действует';
  if (!targets) return `Классов: ${key.classIds.length} · Учеников: ${key.studentIds.length}`;
  const classes = key.classIds.map((id) => {
    const item = targets?.classes.find((entry) => entry.id === id);
    return item ? classLabel(item) : 'Удалённый класс';
  });
  const students = key.studentIds.map((id) => targets?.students.find((entry) => entry.id === id)?.name ?? 'Недоступный ученик');
  const labels = [...classes, ...students];
  return `${labels.slice(0, 3).join('; ')}${labels.length > 3 ? `; ещё ${labels.length - 3}` : ''}`;
}
