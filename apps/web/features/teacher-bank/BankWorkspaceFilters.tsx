"use client";

import { useState, type ComponentProps } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import type { AssessmentBankQuery } from '@continuum/shared';
import SearchField from '@/components/ui/SearchField';
import BankTopicPicker from './BankTopicPicker';
import BankFilterPanel from './BankFilterPanel';
import { taskTypeLabels } from './task-source';
import { topicLabel } from './bank-topics';
import { uploadDateFilter, uploadDateLabel, uploadDateValue } from './upload-date';
import styles from './bank-workspace.module.css';

export const clearedFilters = { search: '', topic: '', topicPath: undefined, type: undefined, exam: undefined, source: undefined, uploadedFrom: undefined, uploadedBefore: undefined };
type Props = { query: AssessmentBankQuery; paths: string[][]; sources: string[]; onChange: (patch: Partial<AssessmentBankQuery>, replace?: boolean) => void };

export default function BankWorkspaceFilters({ query, paths, sources, onChange }: Props) {
  const selected = query.topicPath ?? (query.topic ? [query.topic] : []);
  const active = [query.type, query.exam, query.source, query.uploadedFrom].filter(Boolean).length;
  const chips = [
    selected.length > 0 && { label: topicLabel(selected), clear: { topicPath: undefined, topic: '' } },
    query.type && { label: taskTypeLabels[query.type], clear: { type: undefined } },
    query.exam && { label: query.exam === 'ege' ? 'ЕГЭ' : 'Не ЕГЭ', clear: { exam: undefined } },
    query.source && { label: query.source, clear: { source: undefined } },
    query.uploadedFrom && { label: uploadDateLabel(query.uploadedFrom), clear: uploadDateFilter('') },
  ].filter(item => Boolean(item));
  return <div className={styles.filters}>
    <SearchField label="Поиск задач" value={query.search} placeholder="Найти задачу" maxLength={200} onValueChange={search => onChange({ search }, true)} />
    <div className={styles.filterRow}><BankTopicPicker paths={paths} value={selected} onChange={topicPath => onChange({ topicPath, topic: '' })} />
      <div className={styles.extra}><BankFilterPanel title="Фильтры" label={<><SlidersHorizontal size={16} />Фильтры{active ? ` · ${active}` : ''}</>}>
        {close => <FilterFields query={query} sources={sources} onApply={patch => { onChange(patch); close(); }} />}
      </BankFilterPanel></div>
    </div>
    {(chips.length > 0 || query.search || query.topic || query.topicPath?.length) && <div className={styles.chips} aria-label="Применённые фильтры">
      {chips.map(chip => chip && <button key={chip.label} aria-label={`Сбросить ${chip.label}`} onClick={() => onChange(chip.clear)}>{chip.label}<X size={12} /></button>)}
      <button className={styles.reset} onClick={() => onChange(clearedFilters)}>Сбросить всё</button>
    </div>}
  </div>;
}

function FilterFields({ query, sources, onApply }: { query: AssessmentBankQuery; sources: string[]; onApply: (patch: Partial<AssessmentBankQuery>) => void }) {
  const [draft, setDraft] = useState(query);
  return <form className={styles.filterFields} onSubmit={event => { event.preventDefault(); onApply({ type: draft.type, exam: draft.exam, source: draft.source, uploadedFrom: draft.uploadedFrom, uploadedBefore: draft.uploadedBefore }); }}>
    <label>Дата загрузки<input type="date" value={uploadDateValue(draft.uploadedFrom)} onChange={event => setDraft({ ...draft, ...uploadDateFilter(event.target.value) })} /></label>
    <label>Тип задания<FilterSelect value={draft.type ?? ''} onChange={event => setDraft({ ...draft, type: event.target.value as AssessmentBankQuery['type'] || undefined })}><option value="">Все типы</option>{Object.entries(taskTypeLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</FilterSelect></label>
    <label>ЕГЭ / не ЕГЭ<FilterSelect value={draft.exam ?? ''} onChange={event => setDraft({ ...draft, exam: event.target.value as AssessmentBankQuery['exam'] || undefined })}><option value="">ЕГЭ и не ЕГЭ</option><option value="ege">ЕГЭ</option><option value="none">Не ЕГЭ</option></FilterSelect></label>
    <label>Источник<FilterSelect value={draft.source ?? ''} onChange={event => setDraft({ ...draft, source: event.target.value || undefined })}><option value="">Все источники</option>{[...new Set([...sources, ...(draft.source ? [draft.source] : [])])].map(source => <option key={source}>{source}</option>)}</FilterSelect></label>
    <div className={styles.filterActions}><button type="button" onClick={() => setDraft({ ...draft, ...clearedFilters })}>Сбросить</button><button type="submit">Показать задачи</button></div>
  </form>;
}

function FilterSelect(props: ComponentProps<'select'>) {
  return <span className={styles.selectWrap}><select {...props} /><ChevronDown size={16} aria-hidden="true" /></span>;
}
