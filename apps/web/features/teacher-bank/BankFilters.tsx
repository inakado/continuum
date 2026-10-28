"use client";

import { X } from 'lucide-react';
import SearchField from '@/components/ui/SearchField';
import type { AssessmentBankQuery } from '@continuum/shared';
import BankTopicPicker from './BankTopicPicker';
import BankExtraFilters from './BankExtraFilters';
import { taskTypeLabels } from './task-source';
import { topicLabel } from './bank-topics';
import styles from './bank-filters.module.css';

export default function BankFilters({ query, topicPaths = [], sources = [], onChange }: {
  query: AssessmentBankQuery; topicPaths?: string[][]; sources?: string[];
  onChange: (patch: Partial<AssessmentBankQuery>, replace?: boolean) => void;
}) {
  const selected = query.topicPath ?? (query.topic ? [query.topic] : []);
  const chips: { key: string; label: string; clear: Partial<AssessmentBankQuery> }[] = [];
  if (selected.length) chips.push({ key: 'topic', label: topicLabel(selected), clear: { topicPath: undefined, topic: '' } });
  if (query.type) chips.push({ key: 'type', label: taskTypeLabels[query.type], clear: { type: undefined } });
  if (query.exam) chips.push({ key: 'exam', label: query.exam === 'ege' ? 'ЕГЭ' : 'Не ЕГЭ', clear: { exam: undefined } });
  if (query.source) chips.push({ key: 'source', label: query.source, clear: { source: undefined } });
  return <div className={styles.root}><div className={styles.toolbar}>
    <div className={styles.field}><span className={styles.label}>Поиск задач</span><SearchField label="Поиск по условию, названию или теме" placeholder="Условие, название или тема" maxLength={200} value={query.search} onValueChange={(search) => onChange({ search }, true)} /></div>
    <BankTopicPicker paths={topicPaths} value={selected} onChange={(topicPath) => onChange({ topicPath, topic: '' })} />
    <BankExtraFilters query={query} sources={sources} onChange={onChange} />
  </div>{(chips.length > 0 || query.search) && <div className={styles.chips} aria-label="Применённые фильтры">{chips.map((chip) => <button key={chip.key} type="button" aria-label={`Сбросить ${chip.label}`} onClick={() => onChange(chip.clear)}><span>{chip.label}</span><X size={13} aria-hidden="true" /></button>)}<button className={styles.reset} type="button" onClick={() => onChange({ search: '', topic: '', topicPath: undefined, type: undefined, exam: undefined, source: undefined })}>Сбросить всё</button></div>}</div>;
}
