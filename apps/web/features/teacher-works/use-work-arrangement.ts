"use client";
import { useRef, useState } from 'react';
import { ASSESSMENT_WORK_TASK_LIMIT, type AssessmentTaskView } from '@continuum/shared';
import { moveWorkItem, workDropPosition } from './work-order';

export function useWorkArrangement(tasks: AssessmentTaskView[], onChange: (items: AssessmentTaskView[]) => void) {
  const dragging = useRef<string | null>(null);
  const [drop, setDrop] = useState<{ index: number; after: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [removed, setRemoved] = useState<{ item: AssessmentTaskView; index: number } | null>(null);
  function move(id: string, position: number) {
    const items = moveWorkItem(tasks, id, position);
    if (items === tasks) return;
    onChange(items);
    setAnnouncement(`Задание перемещено на позицию ${position + 1}.`);
  }
  function remove(item: AssessmentTaskView, index: number) {
    onChange(tasks.filter((current) => current.id !== item.id));
    setRemoved({ item, index }); setAnnouncement('Задание убрано из работы.');
  }
  function undo() {
    if (!removed || tasks.some((item) => item.id === removed.item.id)) return;
    if (tasks.length >= ASSESSMENT_WORK_TASK_LIMIT) {
      setAnnouncement('В работе уже 500 заданий. Уберите одно, чтобы восстановить удалённое.');
      return;
    }
    const items = [...tasks]; items.splice(Math.min(removed.index, items.length), 0, removed.item);
    onChange(items); setRemoved(null);
  }
  function dragOver(event: React.DragEvent, index: number) {
    if (!dragging.current) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.querySelector('[data-work-header]')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    setDrop((previous) => previous?.index === index && previous.after === after ? previous : { index, after });
    if (event.clientY < 72) window.scrollBy(0, -16);
    else if (event.clientY > window.innerHeight - 72) window.scrollBy(0, 16);
  }
  function dropItem(event: React.DragEvent, index: number) {
    event.preventDefault();
    const id = dragging.current;
    if (id && drop) move(id, workDropPosition(tasks.findIndex((item) => item.id === id), index, drop.after));
    dragging.current = null; setDrop(null);
  }
  function endDrag() { dragging.current = null; setDrop(null); }
  return { drop, announcement, removed, move, remove, undo, dragOver, dropItem, endDrag, startDrag: (id: string) => { dragging.current = id; } };
}
