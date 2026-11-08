'use client';

import { useCallback, useId, useMemo, useRef, type ReactNode } from 'react';
import { type Point2, type PointView } from './point-position-model';
import { TRAJECTORY_DURATION, trajectoryFrame, trajectoryGeometry } from './trajectory-model';
import { useLessonPlayback } from './useLessonPlayback';
import LessonPlaybackControls from './LessonPlaybackControls';
import styles from './trajectory.module.css';
import { lessonTimeArgument, lessonTimeReadout as format } from './lesson-time';

export default function TrajectoryPlayer({ axes, view, labels, width, height }: {
  axes: ReactNode; view: PointView; labels: readonly Point2[]; width: number; height: number;
}) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const geometry = useMemo(() => trajectoryGeometry(view), [view]);
  const initial = trajectoryFrame(0, view, geometry);
  const paint = useCallback((time: number) => {
    const frame = trajectoryFrame(time, view, geometry), root = svg.current;
    for (const name of ['trail', 'vector', 'arrow'] as const) root?.querySelector(`[data-trajectory="${name}"]`)?.setAttribute('d', frame[name]);
    root?.querySelector('[data-trajectory="point"]')?.setAttribute('transform', `translate(${frame.point[0]} ${frame.point[1]})`);
    root?.querySelector('[data-trajectory="label"]')?.setAttribute('transform', `translate(${frame.label[0]} ${frame.label[1]})`);
    root?.querySelector('[data-trajectory="pointName"]')?.setAttribute('x', String(frame.pointLabel[0]));
    root?.querySelector('[data-trajectory="pointName"]')?.setAttribute('y', String(frame.pointLabel[1]));
    const radiusTime = root?.querySelector('[data-trajectory="radiusTime"]');
    if (radiusTime) radiusTime.textContent = lessonTimeArgument(time);
    const pointTime = root?.querySelector('[data-trajectory="pointTime"]');
    if (pointTime) pointTime.textContent = lessonTimeArgument(time);
  }, [view, geometry]);
  const playback = useLessonPlayback(TRAJECTORY_DURATION, 1, paint, format);
  return <figure id="trajectory-demo" ref={playback.root} className={styles.figure} aria-label="Точка M описывает траекторию; радиус-вектор следует за точкой">
    <svg ref={svg} className={styles.trajectoryArt} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Кривая в системе координат X, Y, Z, точка M и её текущий радиус-вектор">
      <defs><linearGradient id={`${id}-trail`} x1="0" y1="1" x2=".5" y2="0" gradientUnits="objectBoundingBox"><stop stopColor="#91a9cc" /><stop offset="1" stopColor="#445f92" /></linearGradient></defs>
      {axes}
      {labels.map(([x, y], i) => <text key={i} x={x + [-13, 12, 0][i]} y={y + [17, 5, -15][i]} className={styles.axisLabel}>{['X', 'Y', 'Z'][i]}</text>)}
      <text x={view.origin[0] - 19} y={view.origin[1] + 15} className={styles.axisLabel}>O</text>
      <path data-trajectory="trail" d={initial.trail} fill={`url(#${id}-trail)`} />
      <path data-trajectory="vector" d={initial.vector} className={styles.radius} />
      <path data-trajectory="arrow" d={initial.arrow} className={styles.arrow} />
      <g data-trajectory="label" transform={`translate(${initial.label[0]} ${initial.label[1]})`}><text x="-24" className={styles.vectorLabel}>r<tspan data-trajectory="radiusTime" dx="5" className={styles.timeArgument}>(0)</tspan></text><path d="M-24 -13h8m-2-2 2 2-2 2" className={styles.vectorAccent} /></g>
      <g data-trajectory="point" transform={`translate(${initial.point[0]} ${initial.point[1]})`}><circle r="5" className={styles.point} /><text data-trajectory="pointName" x={initial.pointLabel[0]} y={initial.pointLabel[1]} className={styles.pointLabel}>M<tspan data-trajectory="pointTime" className={styles.timeArgument}>(0)</tspan></text></g>
    </svg>
    <LessonPlaybackControls demo="trajectory" playback={playback} duration={TRAJECTORY_DURATION} label="траектория точки" initial={format(0)} />
  </figure>;
}
