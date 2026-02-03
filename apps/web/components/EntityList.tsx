import Link from "next/link";
import type { ReactNode } from "react";
import StatusBadge from "./StatusBadge";
import styles from "./entity-list.module.css";

export type EntityListItem = {
  id: string;
  title: string;
  status?: "draft" | "published" | string;
  href?: string;
  meta?: string;
  actions?: ReactNode;
};

type EntityListProps = {
  title: string;
  items: EntityListItem[];
  emptyLabel?: string;
};

export default function EntityList({ title, items, emptyLabel }: EntityListProps) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.count}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className={styles.empty}>{emptyLabel ?? "Пока пусто"}</div>
      ) : (
        <div className={styles.list}>
          {items.map((item) => (
            <div key={item.id} className={styles.card}>
              <div className={styles.info}>
                <div className={styles.nameRow}>
                  {item.href ? (
                    <Link className={styles.nameLink} href={item.href}>
                      {item.title}
                    </Link>
                  ) : (
                    <span className={styles.name}>{item.title}</span>
                  )}
                  {item.status ? <StatusBadge status={item.status} /> : null}
                </div>
                {item.meta ? <div className={styles.meta}>{item.meta}</div> : null}
              </div>
              <div className={styles.actions}>{item.actions}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
