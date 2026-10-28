"use client";

import * as Dialog from '@radix-ui/react-dialog';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './bank-filters.module.css';

export default function BankFilterPanel({ title, label, wide = false, children }: {
  title: string; label: ReactNode; wide?: boolean; children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(wide ? 620 : 340, window.innerWidth - 32);
      const top = Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - 240));
      setPosition({ left: Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16)), top, width, maxHeight: window.innerHeight - top - 16 });
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, wide]);
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger ref={trigger} className={styles.trigger}>{label}</Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className={styles.overlay} />
      <Dialog.Content style={position} className={styles.panel} aria-describedby={undefined}>
        <div className={styles.panelHeading}><Dialog.Title>{title}</Dialog.Title><Dialog.Close className={styles.iconButton} aria-label="Закрыть фильтр"><X size={18} /></Dialog.Close></div>
        {children(() => setOpen(false))}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
