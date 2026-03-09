import type { HTMLAttributes, ReactNode } from "react";
import Kicker from "./Kicker";
import styles from "./empty-state.module.css";

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  kicker?: ReactNode;
};

export default function EmptyState({
  title,
  description,
  actions,
  kicker,
  className = "",
  ...props
}: EmptyStateProps) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} {...props}>
      {kicker ? <Kicker>{kicker}</Kicker> : null}
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
