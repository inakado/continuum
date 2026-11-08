"use client";
import { useState, type DragEvent } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { GripVertical } from 'lucide-react';
import styles from './teacher-library.module.css';

type Props = { label: string; index: number; count: number; disabled: boolean;
  onMove: (position: number) => void; onDragStart: (event: DragEvent<HTMLButtonElement>) => void; onDragEnd: () => void };

export default function LibraryOrderHandle({ label, index, count, disabled, onMove, onDragStart, onDragEnd }: Props) {
  const [open, setOpen] = useState(false);
  return <Menu.Root modal={false} open={open} onOpenChange={setOpen}>
    <Menu.Trigger asChild><button type="button" className={styles.orderHandle} draggable={!disabled && count > 1} disabled={count < 2} aria-disabled={disabled}
      aria-label={`Переместить ${label}`} aria-describedby="library-order-help" title="Перетащите, используйте стрелки или откройте меню"
      // Radix opens on pointerdown and prevents native dragging. Open on click instead.
      onPointerDownCapture={(event) => event.stopPropagation()}
      onClick={(event) => { if (disabled) event.preventDefault(); else setOpen(!open); }}
      onDragStart={onDragStart} onDragEnd={onDragEnd} onKeyDown={(event) => {
        const positions: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: count - 1 };
        if (disabled) { if (event.key in positions || event.key === 'Enter' || event.key === ' ') event.preventDefault(); return; }
        if (event.key in positions) { event.preventDefault(); onMove(positions[event.key]); }
      }}><GripVertical aria-hidden="true" size={19} /></button></Menu.Trigger>
    <Menu.Portal><Menu.Content className={styles.orderMenu} align="start" sideOffset={4}>
      <Menu.Label className={styles.orderMenuLabel}>Позиция {index + 1} из {count}</Menu.Label>
      <Menu.Item disabled={disabled || index === 0} onSelect={() => onMove(index - 1)}>Выше</Menu.Item>
      <Menu.Item disabled={disabled || index === count - 1} onSelect={() => onMove(index + 1)}>Ниже</Menu.Item>
      <Menu.Separator className={styles.orderMenuRule} />
      <Menu.Item disabled={disabled || index === 0} onSelect={() => onMove(0)}>В начало</Menu.Item>
      <Menu.Item disabled={disabled || index === count - 1} onSelect={() => onMove(count - 1)}>В конец</Menu.Item>
    </Menu.Content></Menu.Portal>
  </Menu.Root>;
}
