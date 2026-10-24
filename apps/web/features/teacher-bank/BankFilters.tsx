"use client";

import { ChevronDown } from 'lucide-react';
import SearchField from '@/components/ui/SearchField';
import type { AssessmentBankQuery } from '@continuum/shared';
import { taskTypeLabels } from './task-source';
import styles from './teacher-bank.module.css';

export default function BankFilters({ query, topics, sources, onChange }: { query: AssessmentBankQuery; topics: string[]; sources: string[]; onChange: (patch: Partial<AssessmentBankQuery>, replace?: boolean) => void }) {
  const providers = [...new Set([...sources, ...(query.source ? [query.source] : [])])];
  const availableTopics = [...new Set([...topics, ...(query.topic ? [query.topic] : [])])];
  return <div className={styles.filters}>
    <SearchField className={styles.search} label="Поиск по условию или названию" placeholder="Поиск по условию или названию" maxLength={200} value={query.search} onValueChange={(search) => onChange({ search }, true)} />
    <label className={styles.select}><span className={styles.srOnly}>Тема</span><select value={query.topic} onChange={(event) => onChange({ topic: event.target.value })}><option value="">Все темы</option>{availableTopics.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={17} aria-hidden="true" /></label>
    <label className={styles.select}><span className={styles.srOnly}>Тип задания</span><select value={query.type ?? ''} onChange={(event) => onChange({ type: event.target.value as AssessmentBankQuery['type'] || undefined })}><option value="">Все типы</option>{Object.entries(taskTypeLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><ChevronDown size={17} aria-hidden="true" /></label>
    <label className={styles.select}><span className={styles.srOnly}>ЕГЭ / не ЕГЭ</span><select value={query.exam ?? ''} onChange={(event) => onChange({ exam: event.target.value as AssessmentBankQuery['exam'] || undefined })}><option value="">ЕГЭ и не ЕГЭ</option><option value="ege">ЕГЭ</option><option value="none">Не ЕГЭ</option></select><ChevronDown size={17} aria-hidden="true" /></label>
    <label className={styles.select}><span className={styles.srOnly}>Источник</span><select value={query.source ?? ''} onChange={(event) => onChange({ source: event.target.value || undefined })}><option value="">Все источники</option>{providers.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={17} aria-hidden="true" /></label>
  </div>;
}
