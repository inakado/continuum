import type { AssignmentReport } from '@continuum/shared';
import { solutionTaskProgress } from '@/lib/assessment/progress-labels';
import ui from '@/features/teacher-works/teacher-works.module.css';
import styles from './teacher-assignments.module.css';
import ReportTestStatus from './ReportTestStatus';

export default function AssignmentProgressRow({ item, data, onSolutions }: { item: AssignmentReport['recipients'][number]; data: AssignmentReport; onSolutions: () => void }) {
  const solutionsLabel = solutionTaskProgress(item.progress.photoTaskCount, data.extendedTaskCount);
  return <tr>
    <td>{item.name}{item.deleted ? <small>Учётная запись удалена</small> : !item.isActive ? <small>Учётная запись отключена</small> : null}</td>
    <td data-label="Класс">{data.classes.find((group) => group.id === item.assignmentId)?.title}</td>
    {data.automaticTaskCount > 0 && <td data-label="Тестовая часть"><ReportTestStatus status={item.status} />
      {item.result ? <small>{item.result.points} из {item.result.maxPoints} · {item.result.percentage}%</small> : <small>Заполнено {item.answeredCount} из {data.automaticTaskCount}</small>}
    </td>}
    {data.extendedTaskCount > 0 && <>
      <td className={styles.report__solutions} data-label="Развёрнутая часть"><button className={`${ui.textButton} ${styles.report__open}`} onClick={onSolutions} aria-label={`Открыть решения: ${item.name}, ${solutionsLabel}`}>{solutionsLabel}</button></td>
      <td data-label="Проверка решений"><span className={item.progress.publishedReviewTaskCount === data.extendedTaskCount ? styles.completed : undefined}>Проверено: {item.progress.publishedReviewTaskCount} из {data.extendedTaskCount}</span></td>
    </>}
  </tr>;
}
