"use client";

import { useState } from 'react';
import type { AssessmentBankQuery } from '@continuum/shared';
import { SlidersHorizontal } from 'lucide-react';
import BankFilterPanel from './BankFilterPanel';
import { taskTypeLabels } from './task-source';
import styles from './bank-filters.module.css';

type Extra = Pick<AssessmentBankQuery, 'type' | 'exam' | 'source'>;
export default function BankExtraFilters({ query, sources, onChange }: { query: AssessmentBankQuery; sources: string[]; onChange: (patch: Extra) => void }) {
  const count = [query.type, query.exam, query.source].filter(Boolean).length;
  return <div className={styles.extra}><BankFilterPanel title="Фильтры" label={<><SlidersHorizontal size={16} aria-hidden="true" />Фильтры{count > 0 ? ` · ${count}` : ''}</>}>
    {(close) => <ExtraFields query={query} sources={sources} onApply={(patch) => { onChange(patch); close(); }} />}
  </BankFilterPanel></div>;
}
function ExtraFields({ query, sources, onApply }: { query: Extra; sources: string[]; onApply: (patch: Extra) => void }) {
  const [draft, setDraft] = useState<Extra>({ type: query.type, exam: query.exam, source: query.source });
  const providers = [...new Set([...sources, ...(draft.source ? [draft.source] : [])])];
  return <><div className={styles.extraFields}>
    <label>Тип задания<select value={draft.type ?? ''} onChange={(event) => setDraft({ ...draft, type: event.target.value as Extra['type'] || undefined })}><option value="">Все типы</option>{Object.entries(taskTypeLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
    <label>ЕГЭ / не ЕГЭ<select value={draft.exam ?? ''} onChange={(event) => setDraft({ ...draft, exam: event.target.value as Extra['exam'] || undefined })}><option value="">ЕГЭ и не ЕГЭ</option><option value="ege">ЕГЭ</option><option value="none">Не ЕГЭ</option></select></label>
    <label>Источник<select value={draft.source ?? ''} onChange={(event) => setDraft({ ...draft, source: event.target.value || undefined })}><option value="">Все источники</option>{providers.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
  </div><div className={styles.panelFooter}><button type="button" onClick={() => setDraft({ type: undefined, exam: undefined, source: undefined })}>Сбросить</button><button type="button" className={styles.apply} onClick={() => onApply(draft)}>Показать задачи</button></div></>;
}
