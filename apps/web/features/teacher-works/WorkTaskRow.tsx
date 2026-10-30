"use client";
import { useRef, useState } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, ChevronUp, GripVertical, MoreHorizontal } from 'lucide-react';
import type { AssessmentTaskView } from '@continuum/shared';
import BankTaskPreview from '@/features/teacher-bank/BankTaskPreview';
import { pointsLabel, taskSourceLabel, taskTypeLabels } from '@/features/teacher-bank/task-source';
import styles from './teacher-works.module.css';

type Props = {
  item: AssessmentTaskView; index: number; count: number; open: boolean;
  drop: 'before' | 'after' | null;
  onToggle: () => void; onMove: (to: number) => void; onRemove: () => void;
  onDragStart: (id: string) => void; onDragEnd: () => void;
  onDragOver: (event: React.DragEvent, index: number) => void; onDrop: (event: React.DragEvent, index: number) => void;
};
export default function WorkTaskRow(props: Props) {
  const { item, index, count, open } = props;
  const header = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);
  return <li className={`${styles.task} ${props.drop === 'before' ? styles.dropBefore : props.drop === 'after' ? styles.dropAfter : ''}`} onDragOver={(event) => props.onDragOver(event, index)} onDrop={(event) => props.onDrop(event, index)}>
    <div ref={header} data-work-header className={`${styles.taskHeader} ${open ? styles.active : ''}`}>
      <button className={styles.grip} draggable aria-label={`Переместить задание ${index + 1}`} title="Перетащите или используйте стрелки клавиатуры" onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); if (header.current) event.dataTransfer.setDragImage(header.current, 24, 24); props.onDragStart(item.id); }} onDragEnd={props.onDragEnd} onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); props.onMove(index + (event.key === 'ArrowUp' ? -1 : 1)); } }}><GripVertical size={21} aria-hidden="true" /></button>
      <span className={styles.number}>{index + 1}</span><button className={styles.taskTitle} aria-expanded={open} onClick={props.onToggle}><strong>{item.task.title}</strong><span>{taskSourceLabel(item.task.source)} · {taskTypeLabels[item.task.type]}</span></button><span className={styles.points}>{pointsLabel(item.task.maxPoints)}</span>
      <button className={styles.iconButton} onClick={props.onToggle} aria-label={`${open ? 'Свернуть' : 'Раскрыть'} задание ${index + 1}`} aria-expanded={open}>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
      <Menu.Root modal={false}><Menu.Trigger asChild><button className={styles.iconButton} aria-label={`Действия с заданием ${index + 1}`}><MoreHorizontal size={20} /></button></Menu.Trigger><Menu.Portal><Menu.Content className={styles.menu} sideOffset={4} align="end"><Menu.Item disabled={index === 0} onSelect={() => props.onMove(index - 1)}>Выше</Menu.Item><Menu.Item disabled={index === count - 1} onSelect={() => props.onMove(index + 1)}>Ниже</Menu.Item><Menu.Item onSelect={() => setMoving(true)}>На позицию…</Menu.Item><Menu.Separator className={styles.menuRule} /><Menu.Item onSelect={props.onRemove}>Убрать из работы</Menu.Item></Menu.Content></Menu.Portal></Menu.Root>
    </div>
    {moving && <form className={styles.moveForm} onSubmit={(event) => { event.preventDefault(); props.onMove(Number(new FormData(event.currentTarget).get('position')) - 1); setMoving(false); }}><label>Позиция<input autoFocus name="position" aria-label="Новая позиция задания" type="number" min={1} max={count} defaultValue={index + 1} required /></label><button className={styles.secondary}>Переместить</button><button type="button" className={styles.textButton} onClick={() => setMoving(false)}>Отмена</button></form>}
    {open && <div className={styles.taskBody}><BankTaskPreview data={item} compact /></div>}
  </li>;
}
