'use client';

import type { ReactNode } from 'react';
import type { useLessonPlayback } from './useLessonPlayback';
import { Pause, Play, RotateCcw } from 'lucide-react';
import styles from './playback-controls.module.css';

export default function LessonPlaybackControls({ playback, duration, label, initial, number }: {
  playback: ReturnType<typeof useLessonPlayback>; duration: number; label: string; initial: string; number: ReactNode;
}) {
  return <div className={styles.controls}>
    {number}
    <button type="button" className={styles.play} onClick={playback.toggle} aria-label={`${playback.playing ? 'Пауза' : playback.finished ? 'Повторить' : 'Запустить'}: ${label}`}>
      {playback.playing ? <Pause size={17} /> : playback.finished ? <RotateCcw size={17} /> : <Play size={17} />}
    </button>
    <input ref={playback.slider} type="range" min="0" max={duration} step={duration / 1000} defaultValue="0" aria-label={`Время: ${label}`} aria-valuetext={initial} onChange={(event) => playback.seek(Number(event.currentTarget.value))} />
    <output ref={playback.readout} aria-live="off">{initial}</output>
  </div>;
}
