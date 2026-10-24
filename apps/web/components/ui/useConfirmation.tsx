"use client";

import { useEffect, useRef, useState } from 'react';
import AlertDialog from './AlertDialog';
import { apiErrorMessage } from '@/lib/api/error-message';

type Confirmation = {
  title: string; description: string; confirmText: string; cancelText?: string; destructive?: boolean;
  returnFocus?: () => void;
};
type Action = Confirmation & { run: () => void | Promise<unknown> };

export function useConfirmation() {
  const [action, setAction] = useState<Action | null>(null);
  const current = useRef<Action | null>(null), flight = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => () => { current.current = null; }, []);
  function close() { if (!flight.current) { current.current = null; setAction(null); } }
  async function execute() {
    const target = current.current;
    if (!target || flight.current) return;
    flight.current = true; setBusy(true); setError('');
    try {
      await target.run();
      if (current.current === target) { current.current = null; setAction(null); }
    } catch (cause) {
      if (current.current === target) setError(apiErrorMessage(cause, 'Не удалось выполнить действие. Повторите попытку.'));
    } finally { flight.current = false; setBusy(false); }
  }
  return {
    ask: (options: Confirmation, run: Action['run']) => {
      if (current.current) return;
      const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const next = { ...options, run, returnFocus: options.returnFocus ?? (() => { if (trigger?.isConnected) trigger.focus(); }) };
      current.current = next; setError(''); setAction(next);
    },
    dialog: action && <AlertDialog open onOpenChange={(open) => { if (!open) close(); }} {...action} busy={busy} error={error} onConfirm={execute} />,
  };
}
