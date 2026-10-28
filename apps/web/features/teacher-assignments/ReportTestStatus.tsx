import { Circle, CircleDot, CircleCheck } from 'lucide-react';
import type { AssignmentReport } from '@continuum/shared';
import styles from './teacher-assignments.module.css';

type Status = AssignmentReport['recipients'][number]['status'];
const states = {
  not_started: { label: 'Не начата', Icon: Circle },
  in_progress: { label: 'В работе', Icon: CircleDot },
  completed: { label: 'Завершена', Icon: CircleCheck },
};

export function TestStatusIcon({ status }: { status: Status }) {
  const Icon = states[status].Icon;
  return <Icon size={14} aria-hidden="true" />;
}

export default function ReportTestStatus({ status }: { status: Status }) {
  return <span className={styles.testStatus} data-status={status}><TestStatusIcon status={status} />{states[status].label}</span>;
}
