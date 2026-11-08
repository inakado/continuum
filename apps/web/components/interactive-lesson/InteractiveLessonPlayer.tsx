'use client';

import { useMemo } from 'react';
import type { InteractiveLessonDocument } from '@continuum/shared';
import ContinuumHeader from '@/components/ContinuumHeader';
import InteractiveLessonNavigation from './InteractiveLessonNavigation';
import { sandboxDocument } from './lesson-sandbox';
import { useLessonSandbox } from './useLessonSandbox';
import styles from './interactive-lesson.module.css';

type Props = { artifact: InteractiveLessonDocument; homeHref: string; storageScope: string };

function LessonPlayer({ artifact, homeHref, storageScope }: Props) {
  const reader = useLessonSandbox(artifact, storageScope);
  const html = useMemo(() => sandboxDocument(artifact.html), [artifact.html]);
  return <div className={styles.page}>
    <ContinuumHeader homeHref={homeHref} subject={<InteractiveLessonNavigation manifest={artifact.manifest} active={reader.active} scale={reader.state.readingScale} onNavigate={reader.navigate} onScale={reader.scale} disabled={!reader.ready} />} />
    <main className={styles.content} aria-label={artifact.manifest.title}>
      <iframe key={reader.attempt} ref={reader.frame} className={styles.frame} title={artifact.manifest.title} srcDoc={html} sandbox="allow-scripts" referrerPolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" />
      {!reader.ready && <div className={styles.status} role={reader.timedOut ? 'alert' : 'status'}>{reader.timedOut ? <><p>Не удалось запустить лекцию.</p><button type="button" onClick={reader.retry}>Попробовать ещё раз</button><a href={homeHref}>К материалам</a></> : 'Загружаем лекцию…'}</div>}
    </main>
  </div>;
}

export default function InteractiveLessonPlayer(props: Props) {
  return <LessonPlayer key={`${props.storageScope}:${props.artifact.artifactId}`} {...props} />;
}
