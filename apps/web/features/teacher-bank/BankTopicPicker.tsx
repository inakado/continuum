"use client";

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight } from 'lucide-react';
import SearchField from '@/components/ui/SearchField';
import BankFilterPanel from './BankFilterPanel';
import { topicChildren, topicLabel, topicOptions } from './bank-topics';
import styles from './bank-filters.module.css';

export default function BankTopicPicker({ paths, value, onChange }: { paths: string[][]; value: string[]; onChange: (path: string[] | undefined) => void }) {
  const options = useMemo(() => topicOptions(value.length ? [...paths, value] : paths), [paths, value]);
  return <div className={styles.field}><span className={styles.label}>Раздел или тема</span>
    <BankFilterPanel wide title="Раздел или тема" label={<><span className={styles.value} title={topicLabel(value)}>{value.length ? topicLabel(value) : 'Все разделы и темы'}</span><ChevronDown size={16} aria-hidden="true" /></>}>
      {(close) => <TopicBrowser options={options} value={value} onSelect={(path) => { onChange(path.length ? path : undefined); close(); }} />}
    </BankFilterPanel>
  </div>;
}

function TopicBrowser({ options, value, onSelect }: { options: string[][]; value: string[]; onSelect: (path: string[]) => void }) {
  const [path, setPath] = useState(() => topicChildren(options, value).length ? value : value.slice(0, -1));
  const [search, setSearch] = useState('');
  const branchAction = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { branchAction.current?.focus(); }, [path]);
  const words = search.trim().toLocaleLowerCase('ru').split(/\s+/);
  const found = search.trim() ? options.filter((item) => words.every((word) => topicLabel(item).toLocaleLowerCase('ru').includes(word))) : [];
  function node(next: string[]) {
    const branch = topicChildren(options, next).length > 0;
    return <li key={JSON.stringify(next)}><button type="button" className={topicLabel(next) === topicLabel(path) ? styles.current : ''} onClick={() => branch ? setPath(next) : onSelect(next)}>
      <span>{next.at(-1)}</span>{branch ? <ChevronRight size={16} aria-label="Открыть подразделы" /> : topicLabel(next) === topicLabel(value) ? <Check size={16} aria-label="Выбрано" /> : null}
    </button></li>;
  }
  return <>
    <div className={styles.topicSearch}><SearchField label="Найти раздел или тему" placeholder="Найти раздел или тему" value={search} onValueChange={setSearch} maxLength={200} /></div>
    <nav className={styles.path} aria-label="Путь темы">{path.length > 0 && <button type="button" onClick={() => setPath(path.slice(0, -1))}><ArrowLeft size={14} />Назад</button>}<span>{topicLabel(path) || 'Все разделы'}</span></nav>
    {search.trim() ? <ul className={styles.searchResults} aria-label="Найденные темы">{found.map((item) => <li key={JSON.stringify(item)}><button type="button" onClick={() => onSelect(item)}><span>{item.at(-1)}<small>{topicLabel(item)}</small></span><Check size={16} aria-hidden="true" /></button></li>)}{!found.length && <li className={styles.noTopics}>Темы не найдены</li>}</ul> : <div className={`${styles.columns} ${path.length ? '' : styles.singleColumn}`}>
      {path.length > 0 && <ul className={styles.parentColumn} aria-label="Разделы">{topicChildren(options, path.slice(0, -1)).map(node)}</ul>}
      <div className={styles.childColumn}><span className={styles.columnLabel}>{path.length ? 'Подразделы и темы' : 'Разделы'}</span><ul aria-label="Подразделы и темы"><li><button ref={branchAction} className={styles.allTopics} type="button" onClick={() => onSelect(path)}><span>{path.length ? `Все задачи: ${path.at(-1)}` : 'Все разделы и темы'}</span><Check size={16} aria-hidden="true" /></button></li>{topicChildren(options, path).map(node)}</ul></div>
    </div>}
  </>;
}
