'use client';

import { useCallback, useId, useState } from 'react';
import LessonPlaybackControls from '@/components/interactive-lesson/authoring/LessonPlaybackControls';
import { LessonInlineMath as MathLabel } from '@/components/interactive-lesson/authoring/LessonEquation';
import { useLessonPlayback } from '@/components/interactive-lesson/authoring/useLessonPlayback';
import { intervalAt, screenPoint, screenVector, speedNumber, velocityTip, tangentInterval, TANGENT_DURATION } from './speed-model';
import { svgPath } from '../curve-ribbon';
import type { Point2 } from '../point-position-model';
import { DemoNumber, StartTime } from './SpeedControls';
import SpeedScene, { Vector } from './SpeedScene';
import styles from './speed-demo.module.css';

const format = (time: number) => `Δt ${speedNumber(tangentInterval(time))} с`;
function lineThrough(point: Point2, vector: Point2) {
  const n = Math.hypot(...vector) || 1, dx = vector[0] / n, dy = vector[1] / n;
  return svgPath([[point[0] - 250 * dx, point[1] - 250 * dy], [point[0] + 450 * dx, point[1] + 450 * dy]]);
}

export default function TangentDemonstration() {
  const id = useId();
  const [start, setStart] = useState(1.5), [time, setTime] = useState(0), [compare, setCompare] = useState(false);
  const paint = useCallback((value: number) => setTime(value), []);
  // В сравнении сохраняем строгое Δt₁ > Δt₂ > Δt₃ ≥ .01 с.
  const duration = compare ? TANGENT_DURATION * Math.log(120) / Math.log(600) : TANGENT_DURATION;
  const playback = useLessonPlayback(duration, 1, paint, format);
  const frame = intervalAt(start, tangentInterval(time)), a = screenPoint(frame.a);
  return <figure id="kin02-tangent-demo" ref={playback.root} className={styles.figure} aria-label="Приближение секущей к касательной" data-speed-demo="tangent" data-start={start} data-interval={frame.dt}>
    <SpeedScene frame={frame} radii={false} average={false} chord={false} trail={!compare} fixedPoint endpointLabel={!compare}>
      <defs><clipPath id={`${id}-clip`}><rect x="18" y="36" width="540" height="380" /></clipPath></defs>
      <g clipPath={`url(#${id}-clip)`}>
        <path d={lineThrough(a, screenVector(frame.instantaneous))} className={styles.tangent} />
        {!compare && <path d={lineThrough(a, screenVector(frame.displacement))} className={styles.secant} />}
      </g>
      {compare && [frame.dt, frame.dt * .5, frame.dt * .2].map((dt, i) => {
        const ghost = intervalAt(start, dt), b = screenPoint(ghost.b);
        const opacity = Math.max(0, Math.min(1, (Math.hypot(b[0] - a[0], b[1] - a[1]) - 25) / 30));
        return <g key={i} opacity={opacity * .85}>
          <g clipPath={`url(#${id}-clip)`}><path d={lineThrough(a, screenVector(ghost.displacement))} className={styles.secant} /></g>
          <Vector from={a} to={b} className={styles.radius} label={`Δr${['₁', '₂', '₃'][i]}`} offset={-16} />
          <circle cx={b[0]} cy={b[1]} r="3.5" fill="#7c90b0" />
          <text x={b[0] + 10} y={b[1] - 12} className={styles.pointLabel}>Δt{['₁', '₂', '₃'][i]}</text>
        </g>;
      })}
      {!compare && <Vector from={a} to={screenPoint(frame.b)} className={styles.radius} />}
      <Vector from={a} to={velocityTip(a, frame.average)} className={styles.chord} label="⟨υ⟩" offset={-23} />
      <Vector from={a} to={velocityTip(a, frame.instantaneous)} className={styles.velocity} label="υ" offset={22} />
    </SpeedScene>
    <div className={styles.metrics} aria-live="off">
      <span><MathLabel tex={String.raw`|\langle\vec\upsilon\rangle|`} /> = {speedNumber(Math.hypot(...frame.average), 3)}<small>м/с</small></span>
      <span className={styles.warm}><MathLabel tex={String.raw`|\vec\upsilon|`} /> = {speedNumber(Math.hypot(...frame.instantaneous), 3)}<small>м/с</small></span>
    </div>
    <StartTime value={start} onChange={value => { playback.seek(time); setStart(value); }} />
    <LessonPlaybackControls playback={playback} duration={duration} label="секущая и касательная, уменьшение Δt" initial={format(0)} number={<DemoNumber number={2} />} />
    <label className={styles.compare}><input type="checkbox" checked={compare} onChange={event => { playback.seek(0); setCompare(event.currentTarget.checked); }} />Сравнить три интервала</label>
  </figure>;
}
