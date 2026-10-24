"use client";
import { useRef, useState } from 'react';
import type { AssessmentDuplicateHints, AssessmentDuplicateMatch } from '@continuum/shared';
import Dialog from '@/components/ui/Dialog';
import { useBankImportTask, useTeacherBankTask } from './use-teacher-bank';
import BankTaskPreview from './BankTaskPreview';
import { taskSourceLabel } from './task-source';
import styles from './teacher-bank.module.css';

const reasons = { source: 'Совпадают источник и номер', statement: 'Совпадает текст условия' };
export default function BankDuplicateWarnings({ previewId, stableId, hints, loading, failed, onRetry }: { previewId: string; stableId: string | null; hints?: AssessmentDuplicateHints; loading: boolean; failed: boolean; onRetry: () => void }) {
  const [comparison, setComparison] = useState<AssessmentDuplicateMatch | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const selected = hints?.tasks.find((task) => task.stableId === stableId);
  return <section className={styles.duplicateHints} aria-label="Возможные совпадения">
    {loading ? <p role="status">Проверяем возможные совпадения… Это не блокирует импорт.</p> : failed || hints?.status === 'unavailable' ? <p>Не удалось проверить совпадения. Это не блокирует импорт.<button type="button" className={styles.textButton} onClick={onRetry}>Повторить проверку</button></p> : <>
      <p role="status">{hints?.tasks.length ? `Возможные совпадения: у ${hints.tasks.length} задач. Они отмечены в списке.` : 'Совпадений по источнику и тексту не найдено.'}</p>
      {selected && <><p className={styles.muted}>Это подсказка, а не запрет. Сравните также рисунки, варианты ответа и ключи.</p><ul>{selected.matches.map((match) => <li key={`${match.target.location}:${match.target.stableId}`}><div><strong>{match.target.title}</strong><span>{match.target.location === 'bank' ? 'В банке' : 'В этом ZIP'} · {taskSourceLabel(match.target.source)}</span><span>{match.reasons.map((reason) => reasons[reason]).join(' · ')}</span></div><button type="button" className={styles.textButton} onClick={(event) => { trigger.current = event.currentTarget; setComparison(match); }}>Сравнить</button></li>)}</ul>{selected.hasMore && <p className={styles.muted}>Показаны первые 5 совпадений.</p>}</>}
    </>}
    {comparison && stableId && <BankDuplicateCompare previewId={previewId} stableId={stableId} match={comparison} close={() => setComparison(null)} restoreFocus={() => trigger.current?.focus()} />}
  </section>;
}

function BankDuplicateCompare({ previewId, stableId, match, close, restoreFocus }: { previewId: string; stableId: string; match: AssessmentDuplicateMatch; close: () => void; restoreFocus: () => void }) {
  const incoming = useBankImportTask(previewId, stableId);
  const bank = useTeacherBankTask(match.target.location === 'bank' ? match.target.taskId : null, match.target.version);
  const packaged = useBankImportTask(previewId, match.target.location === 'package' ? match.target.stableId : null);
  const candidate = match.target.location === 'bank' ? bank : packaged;
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }} title="Сравнение задач" description="Совпадение не препятствует добавлению. Решение принимаете вы." className={styles.compareDialog} overlayClassName={styles.compareOverlay} onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus(); }}>
    <button type="button" className={styles.secondary} onClick={close}>Закрыть сравнение</button>
    <div className={styles.compareColumns}>{[{ label: 'Загружаемая задача', query: incoming }, { label: match.target.location === 'bank' ? `В банке · версия ${match.target.version}` : 'Другая задача в этом ZIP', query: candidate }].map(({ label, query }) => <section key={label}><h3>{label}</h3>{query.isPending ? <p role="status">Загружаем условие…</p> : query.error ? <div role="alert"><p>Не удалось загрузить условие.</p><button type="button" className={styles.textButton} onClick={() => void query.refetch()}>Повторить загрузку</button></div> : query.data && <BankTaskPreview data={query.data} />}</section>)}</div>
  </Dialog>;
}
