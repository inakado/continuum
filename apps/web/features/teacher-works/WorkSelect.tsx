import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './teacher-works.module.css';

export default function WorkSelect(props: ComponentProps<'select'>) {
  return <span className={styles.selectWrap}>
    <select {...props} />
    <ChevronDown size={16} aria-hidden="true" />
  </span>;
}
