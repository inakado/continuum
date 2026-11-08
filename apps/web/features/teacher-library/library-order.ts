import type { GradeBand, ReorderLibraryInput, TeacherLibrary } from '@continuum/shared';

export type LibraryOrderScope = { kind: 'sections'; gradeBand: GradeBand } | { kind: 'lessons'; sectionId: string };
export type LibraryOrderChange = LibraryOrderScope & ReorderLibraryInput & { announcement: string };
export const libraryOrderScopeKey = (scope: LibraryOrderScope) => scope.kind === 'sections' ? `sections:${scope.gradeBand}` : `lessons:${scope.sectionId}`;

export function moveLibraryItem<T extends { id: string }>(items: T[], id: string, position: number): T[] {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0 || position < 0 || position >= items.length || position === from) return items;
  const result = [...items];
  result.splice(position, 0, ...result.splice(from, 1));
  return result;
}

export function projectLibraryOrder(library: TeacherLibrary | undefined, change?: LibraryOrderChange): TeacherLibrary | undefined {
  if (!library || !change) return library;
  const arrange = <T extends { id: string; sortOrder: number }>(items: T[]): T[] => {
    const byId = new Map(items.map((item) => [item.id, item]));
    if (items.length !== change.orderedIds.length || change.orderedIds.some((id) => !byId.has(id))) return items;
    return change.orderedIds.map((id, sortOrder) => ({ ...byId.get(id)!, sortOrder }));
  };
  return { gradeBands: library.gradeBands.map((band) => ({ ...band,
    sections: change.kind === 'sections' && band.code === change.gradeBand ? arrange(band.sections)
      : band.sections.map((section) => change.kind === 'lessons' && section.id === change.sectionId ? { ...section, lessons: arrange(section.lessons) } : section),
  })) };
}
