import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./entity-list.module.css";

export type EntityListItem = {
  id: string;
  title: string;
  meta?: string;
  href?: string;
  actions?: ReactNode;
};

type EntityListProps = {
  title: string;
  items: EntityListItem[];
  emptyLabel?: string;
};

export default function EntityList({ title, items, emptyLabel = "Пока пусто" }: EntityListProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      {items.length === 0 ? (
        <div className={styles.empty}>{emptyLabel}</div>
      ) : (
        <div className={styles.list}>
          {items.map((item) => (
            <article key={item.id} className={styles.item}>
              <div className={styles.content}>
                {item.href ? (
                  <Link className={styles.itemLink} href={item.href}>
                    {item.title}
                  </Link>
                ) : (
                  <div className={styles.itemTitle}>{item.title}</div>
                )}
                {item.meta ? <div className={styles.itemMeta}>{item.meta}</div> : null}
              </div>
              {item.actions ? <div className={styles.actions}>{item.actions}</div> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
