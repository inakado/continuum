"use client";
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { solutionQueryKeys, studentWorkQueryKeys } from '@/lib/query/keys';
import StudentWorksShell from './StudentWorksShell';
import styles from './student-works.module.css';

export default function StudentWorkUnavailable({ id }: { id: string }) {
  const cache = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    void cache.cancelQueries({ queryKey: studentWorkQueryKeys.detail(id) });
    cache.removeQueries({ queryKey: studentWorkQueryKeys.detail(id) });
    cache.removeQueries({ queryKey: solutionQueryKeys.answers(id) });
    void cache.invalidateQueries({ queryKey: studentWorkQueryKeys.list() });
  }, [cache, id]);
  return <StudentWorksShell><div className={styles.heading}><h1 ref={heading} tabIndex={-1}>Работа больше недоступна</h1></div><p>Возможно, преподаватель убрал назначение. Продолжать эту работу нельзя.</p><Link className={styles.textButton} href="/student/works">К работам</Link></StudentWorksShell>;
}
