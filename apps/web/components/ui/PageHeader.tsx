import type { HTMLAttributes, ReactNode } from "react";
import styles from "./page-header.module.css";

type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  title: ReactNode;
  subtitle?: ReactNode;
  kicker?: ReactNode;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  kicker,
  breadcrumbs,
  actions,
  status,
  className = "",
  ...props
}: PageHeaderProps) {
  return (
    <header className={[styles.header, className].filter(Boolean).join(" ")} {...props}>
      {breadcrumbs ? <div className={styles.breadcrumbs}>{breadcrumbs}</div> : null}
      <div className={styles.mainRow}>
        <div className={styles.main}>
          {kicker}
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          {status ? <div className={styles.status}>{status}</div> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}
