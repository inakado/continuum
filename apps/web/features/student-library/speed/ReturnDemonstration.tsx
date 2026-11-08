'use client';

import { useCallback, useState } from 'react';
import LessonPlaybackControls from '@/components/interactive-lesson/authoring/LessonPlaybackControls';
import { LessonInlineMath as MathLabel } from '@/components/interactive-lesson/authoring/LessonEquation';
import { useLessonPlayback } from '@/components/interactive-lesson/authoring/useLessonPlayback';
import { returnFrame, RETURN_DURATION } from './return-model';
import { speedNumber } from './speed-model';
import { Vector, VectorLabel } from './SpeedScene';
import { DemoNumber } from './SpeedControls';
import styles from './speed-demo.module.css';

const format = (t: number) => `${speedNumber(t, 1)} с`;
export default function ReturnDemonstration() {
  const [time, setTime] = useState(0);
  const paint = useCallback((t: number) => setTime(t), []);
  const playback = useLessonPlayback(RETURN_DURATION, 1, paint, format);
  const f = returnFrame(time), x = 80 + f.x * 84;
  return <figure ref={playback.root} id="kin02-return-demo" className={styles.figure} aria-label="Движение по прямой туда и обратно" data-speed-demo="return">
    <svg className={styles.art} viewBox="0 0 600 220" role="img" aria-label="Точка проходит пять метров и возвращается в начальное положение">
      <Vector from={[40, 130]} to={[558, 130]} className={styles.axis} />
      <path d={`M80 130H${80 + f.reached * 84}`} className={styles.returnTrail} />
      <path d="M80 125v10m420-10v10" className={styles.ticks} />
      <text x="80" y="158" textAnchor="middle" className={styles.pointLabel}>0</text><text x="500" y="158" textAnchor="middle" className={styles.pointLabel}>5</text><text x="550" y="158" className={styles.pointLabel}>X, м</text>
      <Vector from={[x, 130]} to={[x + f.velocity * 84, 130]} className={styles.velocity} opacity={Math.min(1, Math.abs(f.velocity) / .08)} />
      <g className={styles.velocity} opacity={Math.min(1, Math.abs(f.velocity) / .08)}><VectorLabel at={[x, 77]} text="υ" /></g>
      <circle cx="80" cy="130" r="4" className={styles.startPoint} />
      <text x="80" y="190" textAnchor="middle" className={styles.pointLabel}>M(0)</text>
      <circle cx={x} cy="130" r="5" className={styles.point} />
      <text x={x + 12} y="108" className={styles.pointLabel}>M(t)</text>
    </svg>
    <div className={styles.metrics} aria-live="off"><span>L = {speedNumber(f.path)}<small>м</small></span><span className={styles.warm}><MathLabel tex={String.raw`|\Delta\vec r|`} /> = {speedNumber(f.displacement)}<small>м</small></span></div>
    <div className={styles.metrics} aria-live="off">
      <span><MathLabel tex={String.raw`\langle\upsilon\rangle_{\text{путь}}`} /> = {speedNumber(f.pathAverage, 3)}<small>м/с</small></span>
      <span className={styles.warm}><MathLabel tex={String.raw`|\langle\vec\upsilon\rangle|`} /> = {speedNumber(f.average, 3)}<small>м/с</small></span>
    </div>
    <LessonPlaybackControls playback={playback} duration={RETURN_DURATION} label="движение туда и обратно" initial={format(0)} number={<DemoNumber number={4} />} />
  </figure>;
}
