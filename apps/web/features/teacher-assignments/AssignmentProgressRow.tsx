import type { AssignmentReport } from '@continuum/shared';
import ui from '@/features/teacher-works/teacher-works.module.css';
import styles from './teacher-assignments.module.css';

const testLabels = { not_started: 'Не начата', in_progress: 'В работе', completed: 'Завершена' };
export default function AssignmentProgressRow({ item, data, onSolutions }: { item: AssignmentReport['recipients'][number]; data: AssignmentReport; onSolutions: () => void }) {
  return <tr>
    <td>{item.name}{item.deleted ? <small>Учётная запись удалена</small> : !item.isActive ? <small>Учётная запись отключена</small> : null}</td>
    <td data-label="Класс">{data.classes.find((group) => group.id === item.assignmentId)?.title}</td>
    {data.automaticTaskCount > 0 && <td data-label="Тестовая часть"><span className={item.status === 'completed' ? styles.completed : undefined}>{testLabels[item.status]}</span>
      {item.result ? <small>{item.result.points} из {item.result.maxPoints} · {item.result.percentage}%</small> : <small>Заполнено {item.answeredCount} из {data.automaticTaskCount}</small>}
    </td>}
    {data.extendedTaskCount > 0 && <>
      <td data-label="Решения"><button className={ui.textButton} onClick={onSolutions}>Фото: {item.progress.photoTaskCount} из {data.extendedTaskCount}</button></td>
      <td data-label="Проверка"><span className={item.progress.publishedReviewTaskCount === data.extendedTaskCount ? styles.completed : undefined}>Опубликовано: {item.progress.publishedReviewTaskCount} из {data.extendedTaskCount}</span></td>
    </>}
  </tr>;
}
