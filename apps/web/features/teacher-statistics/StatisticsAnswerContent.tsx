"use client";
import type { AssessmentAnswer, AssessmentTaskView } from '@continuum/shared';
import BankTaskPreview from '@/features/teacher-bank/BankTaskPreview';
import AssessmentMarkdown from '@/components/assessment/AssessmentMarkdown';
import SolutionPhotoList from '@/components/assessment/SolutionPhotoList';
import { apiErrorMessage } from '@/lib/api/error-message';
import { matchingPositionLabel } from '@/lib/assessment/matching-position';
import ui from '@/features/teacher-works/teacher-works.module.css';
import { useStatisticsDetail } from './use-statistics';
import { ScoreValue } from './ScoreValue';
import styles from './teacher-statistics.module.css';

function answerText(answer: AssessmentAnswer | null, item: AssessmentTaskView) {
  if (!answer) return 'Ответ не дан';
  const task = item.task;
  const number = (id: string) => {
    const index = 'options' in task ? task.options.findIndex((option) => option.id === id) : -1;
    return index >= 0 ? String(index + 1) : id;
  };
  switch (answer.type) {
    case 'short_number': case 'short_text': return answer.value.trim() || 'Ответ не дан';
    case 'single_choice': return answer.optionId ? `Вариант ${number(answer.optionId)}` : 'Ответ не дан';
    case 'multiple_choice': return answer.optionIds.length ? `Варианты: ${answer.optionIds.map(number).join(', ')}` : 'Ответ не дан';
    case 'matching': return task.type === 'matching' ? task.rows.map((row, index) => `${matchingPositionLabel(index)} — ${answer.matches[row.id] ? number(answer.matches[row.id]) : 'нет ответа'}`).join('; ') : 'Ответ не дан';
  }
}
export default function StatisticsAnswerContent({ id, taskId, recipient }: { id: string; taskId: string; recipient?: string }) {
  const query = useStatisticsDetail(id, taskId, recipient);
  const student = query.data?.student;
  const solution = student?.solution;
  return <>
    {query.isPending && <p role="status">Загружаем задание…</p>}
    {query.error && <div role="alert"><p>{apiErrorMessage(query.error)}</p><button className={ui.secondary} onClick={() => void query.refetch()}>Повторить</button></div>}
    {query.data && !query.error && <>
      {student && <h3>{query.data.item.task.title}</h3>}
      {student && <section className={styles.studentAnswer}><h3>{student.score.state === 'in_progress' || student.score.state === 'not_started' ? 'Текущий ответ · работа не завершена' : 'Результат ученика'}</h3><ScoreValue cell={student.score} max={query.data.item.task.maxPoints} />{query.data.item.task.type !== 'extended' && <p className={styles.answerText}>{answerText(student.answer, query.data.item)}</p>}
        {solution && <><SolutionPhotoList photos={solution.photos} />{solution.publishedReview && student.score.state === 'scored' && <a href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}${solution.publishedReview.reportUrl}`} target="_blank" rel="noreferrer" className={ui.textButton}>Опубликованный разбор · PDF</a>}</>}
      </section>}
      <BankTaskPreview data={query.data.item} compact />
      {query.data.item.solution && query.data.item.task.type === 'extended' && <AssessmentMarkdown text={query.data.item.solution} images={query.data.item.images} />}
    </>}
  </>;
}
