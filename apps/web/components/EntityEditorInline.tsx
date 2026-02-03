import type { FormEvent, ReactNode } from "react";
import styles from "./entity-editor-inline.module.css";
import Button from "./ui/Button";

type EntityEditorInlineProps = {
  title: string;
  description?: string;
  submitLabel: string;
  disabled?: boolean;
  error?: string | null;
  onSubmit: () => Promise<void> | void;
  children: ReactNode;
};

export default function EntityEditorInline({
  title,
  description,
  submitLabel,
  disabled,
  error,
  onSubmit,
  children,
}: EntityEditorInlineProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      <div className={styles.fields}>{children}</div>
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.actions}>
        <Button type="submit" disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
