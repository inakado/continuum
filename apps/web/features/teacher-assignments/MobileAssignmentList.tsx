import { ChevronRight } from 'lucide-react';
import type { AssignmentReport } from '@continuum/shared';
import ReportTestStatus from './ReportTestStatus';
import styles from './teacher-assignments.module.css';

type Recipient = AssignmentReport['recipients'][number];
type ProgressProps = { item: Recipient; data: Pick<AssignmentReport, 'automaticTaskCount' | 'extendedTaskCount'> };

export function MobileAssignmentSummary({ item, data }: ProgressProps) {
  return <>
    {data.automaticTaskCount > 0 && <span className={styles.mobileTest}><span>Тест</span>{' '}<ReportTestStatus status={item.status} />{' '}<span>{item.result ? `${item.result.points}/${item.result.maxPoints} баллов` : `${item.answeredCount}/${data.automaticTaskCount} ответов`}</span></span>}
    {data.extendedTaskCount > 0 && <span className={styles.mobileFacts}><span>Решения <b>{item.progress.photoTaskCount}/{data.extendedTaskCount}</b></span>{' '}<span>Проверено <b>{item.progress.publishedReviewTaskCount}/{data.extendedTaskCount}</b></span></span>}
  </>;
}

export default function MobileAssignmentList({ items, data, showClass, onOpen }: { items: Recipient[]; data: AssignmentReport; showClass: boolean; onOpen: (item: Recipient) => void }) {
  return <ul className={styles.mobileReport} aria-label="Выполнение учениками">{items.map(item => <li key={item.id}><button className={styles.mobileRecipient} type="button" aria-label={`Открыть выполнение: ${item.name}`} aria-describedby={`assignment-progress-${item.id}`} onClick={event => { event.currentTarget.focus({ preventScroll: true }); onOpen(item); }}>
    <span className={styles.mobileName}><strong>{item.name}</strong><ChevronRight size={18} aria-hidden="true" /></span>
    {showClass && <span className={styles.mobileClass}>{data.classes.find(group => group.id === item.assignmentId)?.title}</span>}
    {item.deleted ? <span className={styles.mobileClass}>Учётная запись удалена</span> : !item.isActive ? <span className={styles.mobileClass}>Учётная запись отключена</span> : null}
    <span id={`assignment-progress-${item.id}`} className={styles.mobileProgress}><MobileAssignmentSummary item={item} data={data} /></span>
  </button></li>)}</ul>;
}
