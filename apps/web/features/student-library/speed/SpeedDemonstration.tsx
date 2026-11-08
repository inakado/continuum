'use client';

import { useCallback, useState } from 'react';
import LessonPlaybackControls from '@/components/interactive-lesson/authoring/LessonPlaybackControls';
import { useLessonPlayback } from '@/components/interactive-lesson/authoring/useLessonPlayback';
import { LessonInlineMath as MathLabel } from '@/components/interactive-lesson/authoring/LessonEquation';
import { intervalAt, MAX_INTERVAL, MIN_INTERVAL, speedNumber } from './speed-model';
import SpeedScene from './SpeedScene';
import { DemoNumber, StartTime } from './SpeedControls';
import TangentDemonstration from './TangentDemonstration';
import PathDemonstration from './PathDemonstration';
import ReturnDemonstration from './ReturnDemonstration';
import styles from './speed-demo.module.css';

export type SpeedDemoKind = 'average' | 'tangent' | 'path' | 'return';
const initial = 6 - MIN_INTERVAL;
const formatInterval = (value: number) => `Δt ${speedNumber(value + MIN_INTERVAL)} с`;

function AverageDemonstration() {
  const [start, setStart] = useState(1.5);
  const [time, setTime] = useState(initial);
  const paint = useCallback((value: number) => setTime(value), []);
  const playback = useLessonPlayback(MAX_INTERVAL - MIN_INTERVAL, 1, paint, formatInterval, initial);
  const frame = intervalAt(start, time + MIN_INTERVAL);
  return <figure ref={playback.root} id="kin02-average-demo" className={styles.figure} aria-label="Средняя по перемещению скорость" data-speed-demo="average" data-start={start} data-interval={frame.dt}>
    <SpeedScene frame={frame} />
    <div className={styles.metrics} aria-live="off"><span><MathLabel tex={String.raw`|\Delta\vec r|`} /> = {speedNumber(Math.hypot(...frame.displacement))}<small>м</small></span><span className={styles.warm}><MathLabel tex={String.raw`|\langle\vec\upsilon\rangle|`} /> = {speedNumber(Math.hypot(...frame.average))}<small>м/с</small></span></div>
    <StartTime value={start} onChange={value => { playback.seek(time); setStart(value); }} />
    <LessonPlaybackControls playback={playback} duration={MAX_INTERVAL - MIN_INTERVAL} label="средняя скорость, интервал Δt" initial={formatInterval(initial)} number={<DemoNumber number={1} />} />
  </figure>;
}

export default function SpeedDemonstration({ kind }: { kind: SpeedDemoKind }) {
  if (kind === 'average') return <AverageDemonstration />;
  if (kind === 'tangent') return <TangentDemonstration />;
  if (kind === 'path') return <PathDemonstration />;
  return <ReturnDemonstration />;
}
