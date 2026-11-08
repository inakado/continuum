'use client';

import { useId, type ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useMotionDemonstration } from './useMotionDemonstration';
import { axisFrameAt, type CoordinateAxis } from './motion-axis';
import { MOTION_DURATION, MOTION_START, motionNumber } from './motion-model';
import styles from './mechanical-motion.module.css';
import { DemoNumber } from './LessonDemonstration';

const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 305;
const labelPosition = ([x, y]: readonly [number, number]) => ({ left: `${100 * x / VIEW_WIDTH}%`, top: `${100 * y / VIEW_HEIGHT}%` });

export default function MechanicalMotionPlayer({ base, carriage, travel, referenceAnchor, zeroAnchor, axisAnchor, axis, coordinateAxis }: {
  base: ReactNode;
  carriage: ReactNode;
  travel: readonly [number, number];
  referenceAnchor: readonly [number, number];
  zeroAnchor: readonly [number, number];
  axisAnchor: readonly [number, number];
  axis: ReactNode;
  coordinateAxis: CoordinateAxis;
}) {
  const motion = useMotionDemonstration(travel, coordinateAxis);
  const initial = axisFrameAt(MOTION_START, travel, coordinateAxis);
  const gradientId = useId();
  return (
    <figure id="reference-frame-demo" ref={motion.root} className={styles.figure} aria-label="Демонстрация системы отсчёта">
      <div className={styles.scene}>
        <div className={styles.drawing}>
          <span className={styles.referenceLabel} style={labelPosition(referenceAnchor)} aria-hidden="true">Тело отсчёта</span>
          <span className={styles.zeroLabel} style={labelPosition(zeroAnchor)} aria-hidden="true">0</span>
          <span className={styles.axisLabel} style={labelPosition(axisAnchor)} aria-hidden="true">x</span>
          <svg className={styles.art} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-label="Система отсчёта: неподвижная стойка — тело отсчёта, перед платформой ось x, внизу часы t. Пунктир соединяет указатель каретки с её координатой на оси. Градиент идёт от нуля до этой координаты. Ползунок позволяет менять момент времени.">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D7E2F5" />
                <stop offset="55%" stopColor="#A9BFDF" />
                <stop offset="100%" stopColor="#445F92" />
              </linearGradient>
            </defs>
            {base}
            {axis}
            <g ref={motion.carriage} data-motion-carriage>{carriage}</g>
            <path ref={motion.projection} className={styles.projection} d={initial.projection} />
            <path ref={motion.axisProgress} data-motion-progress className={styles.axisProgress} stroke={`url(#${gradientId})`} d={initial.progress} />
            <circle ref={motion.axisMarker} data-motion-marker className={styles.axisMarker} cx={initial.marker[0]} cy={initial.marker[1]} r="3" />
          </svg>
        </div>
      </div>
      <div className={styles.controls}>
        <DemoNumber demo="reference" />
        <button type="button" className={styles.play} onClick={motion.toggle} aria-label={motion.playing ? 'Приостановить движение' : motion.finished ? 'Повторить движение' : 'Запустить движение'}>
          {motion.playing ? <Pause size={17} /> : motion.finished ? <RotateCcw size={17} /> : <Play size={17} />}
        </button>
        <div className={styles.timeline}>
          <label htmlFor="motion-demo-time" className={styles.visuallyHidden}>Время</label>
          <input ref={motion.slider} id="motion-demo-time" type="range" min="0" max={MOTION_DURATION} step="0.01" defaultValue="0" aria-valuetext={`0,0 с; координата x ${motionNumber(MOTION_START)} м`} onChange={(event) => motion.seek(Number(event.currentTarget.value))} />
        </div>
        <div className={styles.clock}>
          <span className={styles.variable} aria-hidden="true">t</span><span aria-hidden="true">=</span>
          <output ref={motion.clock} htmlFor="motion-demo-time" aria-label="Время" aria-live="off">0,0 с</output>
        </div>
      </div>
    </figure>
  );
}
