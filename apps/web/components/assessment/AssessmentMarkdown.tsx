"use client";

import { createElement, memo, useEffect, useRef } from 'react';
import { parseAssessmentMarkdown, type AssessmentMarkdownNode } from '@continuum/shared';
import AssessmentImage from './AssessmentImage';
import styles from './assessment-content.module.css';

const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
const imageUrl = (path: string) => path.startsWith('/teacher/assessment-bank/') || path.startsWith('/student/assessment-works/') ? `${base}${path}` : '';

type MathMetrics = { display: boolean; em: number; ex: number; containerWidth: number; scale: number; family: string };
type MathRuntime = { startup?: { promise?: Promise<void>; document?: { reset: () => void; updateDocument: () => void } }; getMetricsFor?: (node: HTMLElement, display: boolean) => MathMetrics; tex2chtmlPromise?: (tex: string, options: MathMetrics) => Promise<HTMLElement> };
let mathReady: Promise<MathRuntime> | undefined;
function loadMath() {
  if (mathReady) return mathReady;
  mathReady = new Promise<MathRuntime>((resolve, reject) => {
    const runtimeWindow = window as Window & { MathJax?: MathRuntime | object };
    runtimeWindow.MathJax = {
      loader: { paths: { mathjax: '/vendor/mathjax', fonts: '/vendor/mathjax/fonts' }, load: ['[tex]/ams'] },
      tex: { packages: ['base', 'ams'], maxBuffer: 8000, maxMacros: 1000 },
      output: { font: 'mathjax-newcm', linebreaks: { inline: false } }, startup: { typeset: false },
    };
    const script = document.createElement('script'); script.src = '/vendor/mathjax/tex-chtml.js'; script.async = true;
    script.onload = () => {
      const runtime = runtimeWindow.MathJax as MathRuntime;
      void (runtime.startup?.promise ?? Promise.resolve()).then(() => {
        if (!runtime.tex2chtmlPromise || !runtime.getMetricsFor || !runtime.startup?.document) throw new Error('MathJax не загрузился.');
        resolve(runtime);
      }).catch(reject);
    };
    script.onerror = () => { mathReady = undefined; script.remove(); reject(new Error('Не удалось загрузить формулы.')); };
    document.head.appendChild(script);
  });
  return mathReady;
}
function Formula({ value, display }: { value: string; display: boolean }) {
  const slot = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const parent = slot.current?.parentElement;
    let width = parent?.getBoundingClientRect().width;
    async function typeset() {
      const current = ++revision;
      try {
        const runtime = await loadMath();
        await document.fonts?.ready;
        if (!active || current !== revision || !slot.current) return;
        const node = await runtime.tex2chtmlPromise!(value, runtime.getMetricsFor!(slot.current, display));
        if (active && current === revision && slot.current) {
          slot.current.replaceChildren(node);
          runtime.startup!.document!.reset();
          runtime.startup!.document!.updateDocument();
          slot.current.removeAttribute('title');
        }
      } catch {
        if (active && current === revision && slot.current) slot.current.title = 'Не удалось обновить отображение формулы. Попробуйте обновить страницу.';
      }
    }
    void typeset();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width !== width) { width = entry.contentRect.width; void typeset(); }
    });
    if (parent) observer?.observe(parent);
    return () => { active = false; observer?.disconnect(); };
  }, [value, display]);
  return <span className={display ? styles.displayMath : undefined} ref={slot}>{value}</span>;
}
function renderNodes(nodes: AssessmentMarkdownNode[], images: Record<string, string>, prefix = 'n'): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${prefix}-${index}`;
    if (node.kind === 'text') return node.value;
    if (node.kind === 'math') return <Formula key={`${key}-${node.value}`} value={node.value} display={node.display} />;
    if (node.kind === 'image') {
      const src = imageUrl(images[node.src] ?? '');
      return src ? <AssessmentImage key={`${key}-${src}`} src={src} alt={node.alt} /> : <span key={key} role="alert">Рисунок недоступен: {node.alt}</span>;
    }
    if (node.kind === 'link') return <a key={key} href={node.href} target="_blank" rel="noopener noreferrer">{renderNodes(node.children, images, key)}</a>;
    const content = createElement(node.tag, { key, style: node.align ? { textAlign: node.align } : undefined }, ...(node.tag === 'br' ? [] : renderNodes(node.children, images, key)));
    return node.tag === 'table' ? <div key={key} className={styles.tableScroll} tabIndex={0} role="region" aria-label="Таблица данных">{content}</div> : content;
  });
}
const AssessmentMarkdown = memo(function AssessmentMarkdown({ text, images }: { text: string; images: Record<string, string> }) {
  try { return <div className={styles.markdown}>{renderNodes(parseAssessmentMarkdown(text), images)}</div>; }
  catch { return <p role="alert">Не удалось отобразить текст задания.</p>; }
});
export default AssessmentMarkdown;
