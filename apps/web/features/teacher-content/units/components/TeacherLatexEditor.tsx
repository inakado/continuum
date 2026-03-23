"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { syntaxHighlighting, StreamLanguage } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import type CodeMirrorComponent from "@uiw/react-codemirror";
import styles from "../teacher-unit-detail.module.css";

type CodeMirrorProps = ComponentProps<typeof CodeMirrorComponent>;

const CodeMirror = dynamic<CodeMirrorProps>(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className={styles.editorLoading}>Загрузка редактора…</div>,
});

const latexTokenHighlighter: Parameters<typeof syntaxHighlighting>[0] = {
  style(tags) {
    const tagNames = tags.map((tag) => tag.toString());

    if (tagNames.some((name) => name.includes("comment"))) {
      return "cm-latex-comment";
    }

    if (tagNames.some((name) => name.includes("invalid"))) {
      return "cm-latex-invalid";
    }

    if (tagNames.some((name) => name.includes("typeName"))) {
      return "cm-latex-command";
    }

    if (tagNames.some((name) => name.includes("keyword") || name.includes("operator") || name.includes("punctuation"))) {
      return "cm-latex-keyword";
    }

    if (
      tagNames.some(
        (name) =>
          name.includes("atom") ||
          name.includes("string") ||
          name.includes("number") ||
          name.includes("meta") ||
          name.includes("variableName"),
      )
    ) {
      return "cm-latex-accent";
    }

    return null;
  },
};

export function TeacherLatexEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => {
      setIsDarkTheme(root.dataset.theme === "dark");
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      observer.disconnect();
    };
  }, []);

  const editorExtensions = useMemo(() => {
    const baseExtensions = [StreamLanguage.define(stex), EditorView.lineWrapping];

    if (!isDarkTheme) {
      return baseExtensions;
    }

    return [StreamLanguage.define(stex), syntaxHighlighting(latexTokenHighlighter), EditorView.lineWrapping];
  }, [isDarkTheme]);

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
