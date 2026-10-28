import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

export function useAssignedClassesPanel() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(400, window.innerWidth - 32);
      const top = Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - 240));
      setPosition({ '--classes-left': `${Math.max(16, Math.min(rect.left, window.innerWidth - width - 16))}px`, '--classes-top': `${top}px`, '--classes-height': `${window.innerHeight - top - 16}px` } as CSSProperties);
    };
    const dismiss = () => setOpen(false);
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', dismiss);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', dismiss); };
  }, [open]);
  return { open, setOpen, trigger, position };
}
