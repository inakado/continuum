"use client";

import type { AssessmentTaskView } from '@continuum/shared';
import BankMarkdown from '@/components/assessment/AssessmentMarkdown';
import { pointsLabel, taskGradingLabel, taskSourceDetails, taskSourceLabel, taskTypeLabels } from './task-source';
import { matchingPositionLabel, matchingPositionText } from '@/lib/assessment/matching-position';
import styles from './teacher-bank.module.css';

export default function BankTaskPreview({ data, compact = false, hideAnswers = false }: { data: AssessmentTaskView; compact?: boolean; hideAnswers?: boolean }) {
  const { task, images } = data;
  const graphPositions = task.type === 'matching' && task.rows.length === 2 && task.rows.every((row) => row.content.includes('!['));
  const choice = (id: string) => 'options' in task ? task.options.find((option) => option.id === id)?.content ?? id : id;
  function correctAnswer() {
    switch (task.type) {
      case 'short_number': return `${task.grading.answer}${task.unit ? ` ${task.unit}` : ''}`;
      case 'short_text': return task.grading.acceptedAnswers.join('; ');
      case 'single_choice': return choice(task.grading.correctOptionId);
      case 'multiple_choice': return task.grading.correctOptionIds.map(choice).join('\n\n');
      case 'matching': return task.rows.map((row, index) => `${matchingPositionLabel(index)} — ${task.options.findIndex((option) => option.id === task.grading.matches[row.id]) + 1}`).join('; ');
    }
  }
  return <article className={styles.preview}>
    {!compact && <header className={styles.previewHeader}><h2>{task.title}</h2><p>{task.topicPath.join(' / ')} · {taskTypeLabels[task.type]} · {pointsLabel(task.maxPoints)}</p><p className={styles.source}>{taskSourceLabel(task.source)}</p></header>}
    <BankMarkdown text={data.statement} images={images} />
    {'rows' in task && <section className={styles.positions} aria-label="Позиции соответствия"><h3>{graphPositions ? 'Графики' : 'Величины'}</h3><div className={graphPositions ? styles.graphPositions : styles.positionList}>{task.rows.map((row, index) => <div className={styles.positionRow} key={row.id}><span className={styles.optionNumber}>{matchingPositionLabel(index)}</span><BankMarkdown text={matchingPositionText(row.content, index)} images={images} /></div>)}</div></section>}
    {task.type === 'extended' ? <p className={styles.muted}>Ответ — фотографии решения · {pointsLabel(task.maxPoints)}</p> : 'options' in task ? <section className={styles.options} aria-label="Варианты ответа">{task.options.map((option, index) => <div key={option.id}><span className={styles.optionNumber}>{index + 1}</span><BankMarkdown text={option.content} images={images} /></div>)}</section>
      : <label className={styles.answer}>Ответ:<input readOnly aria-label="Поле ответа — предпросмотр" />{'unit' in task ? task.unit : ''}</label>}
    {!hideAnswers && task.type !== 'extended' && <details className={styles.details} open={!compact}><summary>Ответ и проверка<span>Только преподавателю</span></summary><div><BankMarkdown text={correctAnswer() ?? ''} images={images} />
      {task.type === 'short_number' && <p className={styles.muted}>Допустимая погрешность: {task.grading.absoluteTolerance}</p>}
      {data.solution && <BankMarkdown text={data.solution} images={images} />}
    </div></details>}
    {!hideAnswers && <details className={styles.details}><summary>Источник и сведения</summary><dl><div><dt>Тип задания</dt><dd>{taskTypeLabels[task.type]}</dd></div><div><dt>Правило оценивания</dt><dd>{taskGradingLabel(task)}</dd></div>{taskSourceDetails(task.source).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}<div><dt>ID в банке</dt><dd><code>{task.id}</code></dd></div><div><dt>Версия</dt><dd>{data.version}</dd></div></dl></details>}
  </article>;
}
