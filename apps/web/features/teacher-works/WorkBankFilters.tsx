import type { AssessmentBankQuery, GradeBand } from '@continuum/shared';
import BankFilters from '@/features/teacher-bank/BankFilters';
import { workGrades } from './work-labels';
import WorkSelect from './WorkSelect';
import styles from './teacher-works.module.css';

export default function WorkBankFilters({ query, topicPaths, sources = [], onChange }: {
  query: AssessmentBankQuery; topicPaths?: string[][]; sources?: string[]; onChange: (patch: Partial<AssessmentBankQuery>) => void;
}) {
  return <><label className={styles.bankGrade}>Параллель<WorkSelect value={query.gradeBand} onChange={(event) => onChange({ gradeBand: event.target.value as GradeBand, topic: '', topicPath: undefined, source: undefined })}>
    {Object.entries(workGrades).map(([code, label]) => <option value={code} key={code}>{label}</option>)}
  </WorkSelect></label><BankFilters query={query} topicPaths={topicPaths} sources={sources} onChange={onChange} /></>;
}
