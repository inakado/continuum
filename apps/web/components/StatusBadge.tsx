import styles from "./status-badge.module.css";

type StatusBadgeProps = {
  status: "draft" | "published" | string;
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status === "published" ? "published" : "draft";
  const label = normalized === "published" ? "Опубликовано" : "Черновик";
  return (
    <span className={`${styles.badge} ${styles[normalized]}`}>
      {label}
    </span>
  );
}
