'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { LessonReaderState } from '@continuum/shared';

type Answer = 'correct' | 'incorrect';
export type LessonEnvironment = {
  state: LessonReaderState;
  setReadingScale: (value: number) => void;
  saveAnswer: (id: string, answer: Answer) => void;
};
const Environment = createContext<LessonEnvironment | null>(null);
export const LessonEnvironmentProvider = Environment.Provider;
export const useLessonEnvironment = () => useContext(Environment);

export function lessonReadingTop() {
  return document.querySelector('[data-lesson-chrome], header:not([data-lesson-intro])')?.getBoundingClientRect().bottom ?? 0;
}

const FormulaRenderer = createContext<((tex: string, display: boolean) => ReactNode) | null>(null);
export const LessonFormulaProvider = FormulaRenderer.Provider;
export const useLessonFormulaRenderer = () => useContext(FormulaRenderer);

// Host visibility supplements document.hidden when an iframe is covered or hidden.
export const lessonHostVisible = () => document.documentElement.dataset.lessonHostVisible !== 'false';
