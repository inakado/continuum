"use client";

import { useState } from 'react';
import Image from 'next/image';
import styles from './assessment-content.module.css';

export default function AssessmentImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={styles.imageError} role="alert"><span>Не удалось загрузить рисунок «{alt || 'Без подписи'}».</span><button className={styles.textButton} onClick={() => setFailed(false)} aria-label="Повторить загрузку рисунка">Повторить</button></span>;
  return <Image src={src} alt={alt} unoptimized crossOrigin="use-credentials" width={1200} height={800} className={styles.taskImage} onError={() => setFailed(true)} />;
}
