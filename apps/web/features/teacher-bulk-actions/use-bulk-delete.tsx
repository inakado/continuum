"use client";
import { BULK_ACTION_LIMIT } from "@continuum/shared";
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useConfirmation } from '@/components/ui/useConfirmation';
import BulkActionBar, { BulkUndoNotice } from './BulkActionBar';

type RecordWithId = { id: string };
export function useBulkDelete<T extends RecordWithId, Receipt extends { items: RecordWithId[] }>({ scope, items, queryKey, remove, restore, title, description, label }: {
  scope: string; items: T[]; queryKey: QueryKey; remove: (items: T[]) => Promise<Receipt>; restore: (receipt: Receipt) => Promise<unknown>; title: string; description: string; label: (item: T) => string;
}) {
  const cache = useQueryClient(), confirmation = useConfirmation();
  const [selection, setSelection] = useState<{ scope: string; ids: Set<string> }>({ scope, ids: new Set() });
  useEffect(() => { setSelection({ scope, ids: new Set() }); }, [scope]);
  const [notices, setNotices] = useState<Array<{ id: string; receipt: Receipt }>>([]);
  const ids = new Set(items.filter(item => selection.scope === scope && selection.ids.has(item.id)).map(item => item.id));
  const refresh = () => cache.invalidateQueries({ queryKey });
  const deletion = useMutation({ mutationFn: remove, retry: false,
    onSuccess: async receipt => { setNotices(previous => [...previous, { id: crypto.randomUUID(), receipt }]); setSelection({ scope, ids: new Set() }); await refresh(); },
    onError: refresh,
  });
  const ask = (targets: T[], returnFocus?: () => void) => confirmation.ask({ title, description: `Выбрано: ${targets.length}. ${targets.length === 1 ? `«${label(targets[0])}». ` : ""}${description}`, confirmText: `Удалить (${targets.length})`, destructive: true, returnFocus }, () => deletion.mutateAsync(targets));
  const clear = () => setSelection({ scope, ids: new Set() });
  return {
    ids, busy: deletion.isPending, ask,
    toggle: (id: string) => { const next = new Set(ids); if (next.has(id)) next.delete(id); else if (next.size < BULK_ACTION_LIMIT) next.add(id); setSelection({ scope, ids: next }); },
    canSelect: (id: string) => !deletion.isPending && (ids.has(id) || ids.size < BULK_ACTION_LIMIT),
    bar: <BulkActionBar count={ids.size} total={items.length} busy={deletion.isPending} onClear={clear} onAll={() => setSelection({ scope, ids: ids.size === Math.min(items.length, BULK_ACTION_LIMIT) ? new Set() : new Set(items.slice(0, BULK_ACTION_LIMIT).map(item => item.id)) })} onDelete={returnFocus => ask(items.filter(item => ids.has(item.id)), returnFocus)} />,
    notices: notices.map(notice => <BulkUndoNotice key={notice.id} count={notice.receipt.items.length} onUndo={async () => { await restore(notice.receipt); await refresh(); }} onDismiss={() => setNotices(previous => previous.filter(item => item.id !== notice.id))} />),
    dialog: confirmation.dialog,
  };
}
