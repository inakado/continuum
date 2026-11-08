"use client";
import { useRef, useState, type DragEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TeacherLibrary } from '@continuum/shared';
import { ApiError } from '@/lib/api/client';
import { teacherLibraryQueryKeys } from '@/lib/query/keys';
import { teacherLibraryApi } from './teacher-library.api';
import { libraryOrderScopeKey, moveLibraryItem, projectLibraryOrder, type LibraryOrderChange, type LibraryOrderScope } from './library-order';

export function useLibraryOrder(data: TeacherLibrary | undefined) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (change: LibraryOrderChange) => {
      const body = { expectedIds: change.expectedIds, orderedIds: change.orderedIds };
      return change.kind === 'sections' ? teacherLibraryApi.reorderSections({ ...body, gradeBand: change.gradeBand }) : teacherLibraryApi.reorderLessons(change.sectionId, body);
    },
    onMutate: () => client.cancelQueries({ queryKey: teacherLibraryQueryKeys.all() }),
    onSettled: () => client.invalidateQueries({ queryKey: teacherLibraryQueryKeys.all() }),
  });
  function move(scope: LibraryOrderScope, id: string, position: number) {
    if (mutation.isPending || !data) return false;
    const sections = data.gradeBands.flatMap((band) => band.sections);
    const items: Array<{ id: string; title: string }> = scope.kind === 'sections' ? data.gradeBands.find((band) => band.code === scope.gradeBand)?.sections ?? []
      : sections.find((section) => section.id === scope.sectionId)?.lessons ?? [];
    const next = moveLibraryItem(items, id, position);
    if (next === items) return false;
    const label = scope.kind === 'sections' ? 'Раздел' : 'Занятие';
    mutation.mutate({ ...scope, expectedIds: items.map((item) => item.id), orderedIds: next.map((item) => item.id), announcement: `${label} «${items.find((item) => item.id === id)?.title}» — позиция ${position + 1} из ${items.length}. Порядок сохранён.` });
    return true;
  }
  const error = mutation.isError ? mutation.error instanceof ApiError && mutation.error.status === 409
    ? 'Список уже изменился. Проверьте порядок и повторите перемещение.'
    : 'Не удалось сохранить порядок. Проверьте список и повторите перемещение.' : '';
  return { library: projectLibraryOrder(data, mutation.isPending ? mutation.variables : undefined), move, pending: mutation.isPending,
    message: mutation.isPending ? 'Сохраняем порядок…' : mutation.isSuccess ? mutation.variables.announcement : '', error };
}

export function useLibraryDrag(onMove: (scope: LibraryOrderScope, id: string, position: number) => void) {
  const dragging = useRef<{ scope: string; id: string } | null>(null);
  const [target, setTarget] = useState<{ scope: string; index: number; after: boolean } | null>(null);
  const end = () => { dragging.current = null; setTarget(null); };
  const afterHeader = (event: DragEvent) => {
    const header = event.currentTarget.querySelector('[data-library-order-header]') ?? event.currentTarget;
    const rect = header.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2;
  };
  return {
    end,
    edge: (scope: LibraryOrderScope, index: number) => target?.scope === libraryOrderScopeKey(scope) && target.index === index ? target.after ? 'after' : 'before' : undefined,
    start: (event: DragEvent<HTMLButtonElement>, scope: LibraryOrderScope, id: string) => {
      dragging.current = { scope: libraryOrderScopeKey(scope), id };
      event.stopPropagation(); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id);
      const header = event.currentTarget.closest<HTMLElement>('[data-library-order-header]');
      if (header) event.dataTransfer.setDragImage(header, 24, 16);
    },
    over: (event: DragEvent, scope: LibraryOrderScope, index: number) => {
      const key = libraryOrderScopeKey(scope);
      if (dragging.current?.scope !== key) return;
      event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move';
      const after = afterHeader(event);
      setTarget((old) => old?.scope === key && old.index === index && old.after === after ? old : { scope: key, index, after });
    },
    drop: (event: DragEvent, scope: LibraryOrderScope, ids: string[], index: number) => {
      const active = dragging.current;
      if (!active || active.scope !== libraryOrderScopeKey(scope)) return;
      event.preventDefault(); event.stopPropagation();
      const from = ids.indexOf(active.id);
      if (from >= 0 && from !== index) onMove(scope, active.id, index + (afterHeader(event) ? 1 : 0) - (from < index ? 1 : 0));
      end();
    },
  };
}
