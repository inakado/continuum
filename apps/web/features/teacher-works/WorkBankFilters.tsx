import type { AssessmentBankQuery, GradeBand } from '@continuum/shared';
import { taskTypeLabels } from '@/features/teacher-bank/task-source';
import { workGrades } from './work-labels';
import WorkSelect from './WorkSelect';
import styles from './teacher-works.module.css';

export default function WorkBankFilters({ query, topics, onChange }: { query: AssessmentBankQuery; topics: string[]; onChange: (patch: Partial<AssessmentBankQuery>) => void }) {
  return <div className={styles.filters}>
    <label>Параллель<WorkSelect value={query.gradeBand} onChange={(event) => onChange({ gradeBand: event.target.value as GradeBand, topic: '' })}>
      {Object.entries(workGrades).map(([code, label]) => <option value={code} key={code}>{label}</option>)}
    </WorkSelect></label>
    <label>Поиск<input type="search" aria-label="Поиск заданий" placeholder="Условие, название или номер" maxLength={200} value={query.search} onChange={(event) => onChange({ search: event.target.value })} /></label>
    <label>Тема<WorkSelect value={query.topic} onChange={(event) => onChange({ topic: event.target.value })}>
      <option value="">Все темы</option>{topics.map((value) => <option key={value}>{value}</option>)}
    </WorkSelect></label>
    <label>Тип<WorkSelect value={query.type ?? ''} onChange={(event) => onChange({ type: event.target.value as AssessmentBankQuery['type'] || undefined })}>
      <option value="">Все типы</option>{Object.entries(taskTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </WorkSelect></label>
  </div>;
}
