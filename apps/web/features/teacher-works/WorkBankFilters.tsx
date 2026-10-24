import type { AssessmentBankQuery, GradeBand } from '@continuum/shared';
import { taskTypeLabels } from '@/features/teacher-bank/task-source';
import { workGrades } from './work-labels';
import WorkSelect from './WorkSelect';
import SearchField from '@/components/ui/SearchField';
import styles from './teacher-works.module.css';

export default function WorkBankFilters({ query, topics, sources = [], onChange }: { query: AssessmentBankQuery; topics: string[]; sources?: string[]; onChange: (patch: Partial<AssessmentBankQuery>) => void }) {
  const providers = [...new Set([...sources, ...(query.source ? [query.source] : [])])];
  const availableTopics = [...new Set([...topics, ...(query.topic ? [query.topic] : [])])];
  return <div className={styles.filters}>
    <label>Параллель<WorkSelect value={query.gradeBand} onChange={(event) => onChange({ gradeBand: event.target.value as GradeBand, topic: '', source: undefined })}>
      {Object.entries(workGrades).map(([code, label]) => <option value={code} key={code}>{label}</option>)}
    </WorkSelect></label>
    <label>Поиск<SearchField label="Поиск заданий" placeholder="Условие, название или номер" maxLength={200} value={query.search} onValueChange={(search) => onChange({ search })} /></label>
    <label>Тема<WorkSelect value={query.topic} onChange={(event) => onChange({ topic: event.target.value })}>
      <option value="">Все темы</option>{availableTopics.map((value) => <option key={value}>{value}</option>)}
    </WorkSelect></label>
    <label>Тип<WorkSelect value={query.type ?? ''} onChange={(event) => onChange({ type: event.target.value as AssessmentBankQuery['type'] || undefined })}>
      <option value="">Все типы</option>{Object.entries(taskTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </WorkSelect></label>
    <label>ЕГЭ / не ЕГЭ<WorkSelect value={query.exam ?? ''} onChange={(event) => onChange({ exam: event.target.value as AssessmentBankQuery['exam'] || undefined })}><option value="">ЕГЭ и не ЕГЭ</option><option value="ege">ЕГЭ</option><option value="none">Не ЕГЭ</option></WorkSelect></label>
    <label>Источник<WorkSelect value={query.source ?? ''} onChange={(event) => onChange({ source: event.target.value || undefined })}><option value="">Все источники</option>{providers.map((source) => <option key={source} value={source}>{source}</option>)}</WorkSelect></label>
  </div>;
}
