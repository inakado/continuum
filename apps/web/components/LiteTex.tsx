"use client";

import { memo, useMemo } from "react";
import katex from "katex";
import styles from "./lite-tex.module.css";

type LiteTexProps = {
  value: string;
  block?: boolean;
  className?: string;
};

type Segment =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

const mathCache = new Map<string, string>();

const splitByMath = (input: string): Segment[] => {
  const segments: Segment[] = [];
  let i = 0;
  let buffer = "";

  const flushText = () => {
    if (buffer) {
      segments.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  while (i < input.length) {
    if (input[i] === "\\") {
      buffer += input[i];
      if (i + 1 < input.length) {
        buffer += input[i + 1];
        i += 2;
        continue;
      }
    }

    if (input[i] === "$") {
      const isDisplay = input[i + 1] === "$";
      const delimiter = isDisplay ? "$$" : "$";
      const start = i + delimiter.length;
      const end = input.indexOf(delimiter, start);
      if (end !== -1) {
        flushText();
        const mathValue = input.slice(start, end);
        segments.push({ type: "math", value: mathValue, display: isDisplay });
        i = end + delimiter.length;
        continue;
      }
    }

    buffer += input[i];
    i += 1;
  }

  flushText();
  return segments;
};

const renderMath = (value: string, display: boolean) => {
  const key = `${display ? "1" : "0"}|${value}`;
  const cached = mathCache.get(key);
  if (cached) return cached;

  let html: string;
  try {
    html = katex.renderToString(value, {
      displayMode: display,
      throwOnError: false,
      strict: "warn",
    });
  } catch {
    html = value;
  }

  mathCache.set(key, html);
  return html;
};

const LiteTex = memo(function LiteTex({ value, block = false, className = "" }: LiteTexProps) {
  const segments = useMemo(() => splitByMath(value), [value]);
  const renderedSegments = useMemo(() => {
    if (!value.trim()) return null;
    return segments.map((segment, index) => {
      if (segment.type === "text") {
        return (
          <span key={`text-${index}`} className={styles.text}>
            {segment.value}
          </span>
        );
      }
      const html = renderMath(segment.value, segment.display);
      return (
        <span
          key={`math-${index}`}
          className={segment.display ? styles.mathBlock : styles.mathInline}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    });
  }, [segments, value]);

  if (!value.trim()) {
    return <span className={`${styles.placeholder} ${className}`}>—</span>;
  }

  const Container = block ? "div" : "span";

  return (
    <Container className={`${block ? styles.block : styles.inline} ${className}`}>
      {renderedSegments}
    </Container>
  );
});

export default LiteTex;
