import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./school-classes.module.css";

// Native selection and form semantics; one inset icon across the students feature.
export default function StudentSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className={styles.selectWrap}>
    <select {...props} />
    <ChevronDown size={16} strokeWidth={1.6} aria-hidden="true" />
  </span>;
}
