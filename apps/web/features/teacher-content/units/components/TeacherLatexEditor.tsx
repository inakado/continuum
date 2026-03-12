"use client";

import dynamic from "next/dynamic";
import { useMemo, type ComponentProps } from "react";
import { EditorView } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import type CodeMirrorComponent from "@uiw/react-codemirror";
import styles from "../teacher-unit-detail.module.css";

type CodeMirrorProps = ComponentProps<typeof CodeMirrorComponent>;

const CodeMirror = dynamic<CodeMirrorProps>(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className={styles.editorLoading}>Загрузка редактора…</div>,
});

export function TeacherLatexEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editorExtensions = useMemo(() => [StreamLanguage.define(stex), EditorView.lineWrapping], []);

  return (
    <CodeMirror
      className={styles.codeEditor}
      value={value}
      height="100%"
      onChange={onChange}
      extensions={editorExtensions}
    />
  );
}
