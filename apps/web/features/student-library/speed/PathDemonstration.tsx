'use client';

import { useCallback, useState } from 'react';
import LessonPlaybackControls from '@/components/interactive-lesson/authoring/LessonPlaybackControls';
import { LessonInlineMath as MathLabel } from '@/components/interactive-lesson/authoring/LessonEquation';
import { useLessonPlayback } from '@/components/interactive-lesson/authoring/useLessonPlayback';
import { MIN_INTERVAL, MAX_INTERVAL, magnitude, speedNumber, positionAt, screenPoint } from './speed-model';
import { pathInterval } from './speed-path-model';
import SpeedScene, { curveBetween, Vector } from './SpeedScene';
import { DemoNumber, StartTime } from './SpeedControls';
import styles from './speed-demo.module.css';

const initial = 6 - MIN_INTERVAL;
const format = (time: number) => `Δt ${speedNumber(time + MIN_INTERVAL)} с`;
export default function PathDemonstration() {
  const [start, setStart] = useState(1.5), [time, setTime] = useState(initial), [compare, setCompare] = useState(false);
  const paint = useCallback((value: number) => setTime(value), []);
  const playback = useLessonPlayback(MAX_INTERVAL - MIN_INTERVAL, 1, paint, format, initial);
  const frame = pathInterval(start, time + MIN_INTERVAL);
  const origin = screenPoint(positionAt(0));
  return <figure id="kin02-path-demo" ref={playback.root} className={styles.figure} aria-label="Средняя путевая скорость и сравнение с модулем средней скорости" data-speed-demo="path" data-start={start} data-interval={frame.dt}>
    <SpeedScene frame={frame} radii={false} average={false} chord={false}>
      <path d={curveBetween(0, frame.t)} className={styles.previousPath} />
      {compare && <Vector from={screenPoint(frame.a)} to={screenPoint(frame.b)} className={styles.velocity} label="Δr" offset={-20} opacity={Math.min(1, frame.dt / .8)} />}
      <circle cx={origin[0]} cy={origin[1]} r="3" className={styles.startPoint} />
      <text x={origin[0] - 12} y={origin[1] + 24} textAnchor="end" className={styles.pointLabel}>M(0)</text>
    </SpeedScene>
    <div className={styles.pathCalculation} aria-live="off">
      <MathLabel tex={String.raw`\Delta L=L(t+\Delta t)-L(t)`} />
      <span>≈ {speedNumber(frame.path, frame.dt < .1 ? 4 : 2)} м</span>
    </div>
    <div className={styles.metrics} aria-live="off">
      <span><MathLabel tex={String.raw`\langle\upsilon\rangle_{\text{путь}}`} /> = {speedNumber(frame.pathAverage, 3)}<small>м/с</small></span>
      {compare && <span className={styles.warm}><MathLabel tex={String.raw`|\langle\vec\upsilon\rangle|`} /> = {speedNumber(magnitude(frame.average), 3)}<small>м/с</small></span>}
    </div>
    <StartTime value={start} onChange={value => { playback.seek(time); setStart(value); }} />
    <LessonPlaybackControls playback={playback} duration={MAX_INTERVAL - MIN_INTERVAL} label="путь на интервале Δt" initial={format(initial)} number={<DemoNumber number={3} />} />
    <label className={styles.compare}><input type="checkbox" checked={compare} onChange={event => setCompare(event.currentTarget.checked)} />Сравнить две средние скорости</label>
  </figure>;
}
