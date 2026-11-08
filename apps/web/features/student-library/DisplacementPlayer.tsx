'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Point2, PointView } from './point-position-model';
import { svgVector } from './curve-ribbon';
import { DISPLACEMENT_DURATION, DISPLACEMENT_ROUTES, displacementFrame, displacementGeometry, displacementNumber, type DisplacementRoute } from './displacement-model';
import { useLessonPlayback } from './useLessonPlayback';
import LessonPlaybackControls from './LessonPlaybackControls';
import styles from './displacement.module.css';
import { lessonTimeArgument, lessonTimeReadout as format } from './lesson-time';
const titles = { line: 'Прямая', arc: 'Дуга', return: 'Замкнутая' };
const translate = ([x, y]: Point2) => `translate(${x} ${y})`;

export default function DisplacementPlayer({ axes, view, labels, width, height }: {
  axes: ReactNode; view: PointView; labels: readonly Point2[]; width: number; height: number;
}) {
  const drawing = useRef<SVGSVGElement>(null);
  const pathReadout = useRef<HTMLOutputElement>(null), displacementReadout = useRef<HTMLOutputElement>(null);
  const route = useRef<DisplacementRoute>('arc');
  const [selected, setSelected] = useState<DisplacementRoute>('arc');
  const routes = useMemo(() => ({ line: displacementGeometry('line', view), arc: displacementGeometry('arc', view), return: displacementGeometry('return', view) }), [view]);
  const initial = displacementFrame(0, view, routes.arc), start = routes.arc.points[0];
  const initialRadius = svgVector(view.origin, start);
  const paint = useCallback((time: number) => {
    const geometry = routes[route.current], state = displacementFrame(time, view, geometry), svg = drawing.current;
    const attr = (name: string, attribute: string, value: string) => svg?.querySelector(`[data-displacement="${name}"]`)?.setAttribute(attribute, value);
    attr('guide', 'd', geometry.guide); attr('trail', 'd', state.trail);
    attr('radius', 'd', state.radius.vector); attr('radiusArrow', 'd', state.radius.arrow);
    attr('radiusLabel', 'transform', translate(state.radius.label));
    attr('initialRadiusLabel', 'transform', translate(state.initialRadiusLabel));
    attr('radiusLabel', 'visibility', state.separate ? 'visible' : 'hidden');
    attr('currentRadius', 'visibility', state.separate ? 'visible' : 'hidden');
    for (const name of ['currentRadius', 'radiusLabel', 'startLabel', 'SLabel']) attr(name, 'opacity', String(state.radiusOpacity));
    attr('S', 'd', state.displacement.vector); attr('SArrow', 'd', state.displacement.arrow);
    attr('SLabel', 'transform', translate(state.displacement.label));
    attr('SLabel', 'visibility', state.displacement.visible ? 'visible' : 'hidden');
    attr('point', 'transform', translate(state.point));
    attr('startLabel', 'visibility', state.separate ? 'visible' : 'hidden');
    attr('startLabel', 'x', String(state.startLabel[0]));
    attr('startLabel', 'y', String(state.startLabel[1]));
    const radiusTime = svg?.querySelector('[data-displacement="radiusTime"]');
    if (radiusTime) radiusTime.textContent = lessonTimeArgument(time);
    const displacementTime = svg?.querySelector('[data-displacement="displacementTime"]');
    if (displacementTime) displacementTime.textContent = lessonTimeArgument(time);
    attr('pointEquality', 'display', state.distance <= 1e-8 && time >= DISPLACEMENT_DURATION ? 'inline' : 'none');
    const pointTime = svg?.querySelector('[data-displacement="pointTime"]');
    if (pointTime) pointTime.textContent = lessonTimeArgument(time);
    const name = svg?.querySelector('[data-displacement="pointName"]');
    if (name) {
      name.setAttribute('x', String(state.pointLabel[0]));
      name.setAttribute('y', String(state.pointLabel[1]));
      name.setAttribute('text-anchor', state.pointAnchor);
    }
    if (pathReadout.current) pathReadout.current.textContent = displacementNumber(state.path);
    if (displacementReadout.current) displacementReadout.current.textContent = displacementNumber(state.distance);
  }, [routes, view]);
  const playback = useLessonPlayback(DISPLACEMENT_DURATION, 1, paint, format);
  function choose(next: DisplacementRoute) {
    route.current = next; setSelected(next);
    playback.seek(0);
  }
  return <figure id="displacement-demo" ref={playback.root} className={styles.figure} data-route={selected} aria-label="Сравнение пути и перемещения: прямая, дуга и возвращение в начало">
    <div className={styles.routes} role="group" aria-label="Маршрут движения">
      {DISPLACEMENT_ROUTES.map((value) => <button key={value} type="button" aria-pressed={selected === value} onClick={() => choose(value)}>{titles[value]}</button>)}
    </div>
    <svg ref={drawing} className={styles.art} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Путь L вдоль траектории и вектор перемещения S от M(0) до M(t)">
      {axes}
      {labels.map(([x, y], i) => <text key={i} x={x + [-13, 12, 0][i]} y={y + [17, 5, -15][i]} className={styles.axisLabel}>{['X', 'Y', 'Z'][i]}</text>)}
      <text x={view.origin[0] - 19} y={view.origin[1] + 15} className={styles.axisLabel}>O</text>
      <path data-displacement="guide" d={routes.arc.guide} className={styles.guide} />
      <path data-displacement="trail" d={initial.trail} className={styles.trail} />
      <path d={initialRadius.vector} className={styles.radius} /><path d={initialRadius.arrow} className={styles.radiusArrow} />
      <g data-displacement="currentRadius" visibility="hidden">
        <path data-displacement="radius" d={initial.radius.vector} className={styles.radius} /><path data-displacement="radiusArrow" d={initial.radius.arrow} className={styles.radiusArrow} />
      </g>
      <path data-displacement="S" d={initial.displacement.vector} className={styles.displacement} /><path data-displacement="SArrow" d={initial.displacement.arrow} className={styles.displacementArrow} />
      <g data-displacement="initialRadiusLabel" transform={translate(initial.initialRadiusLabel)}><text textAnchor="middle" className={styles.radiusLabel}>r<tspan baselineShift="sub" fontSize="10">0</tspan></text><path d="M-9 -13H1m-3-2 3 2-3 2" className={styles.radiusAccent} /></g>
      <g data-displacement="radiusLabel" visibility="hidden" transform={translate(initial.radius.label)}><text x="-24" className={styles.radiusLabel}>r<tspan data-displacement="radiusTime" dx="5" className={styles.timeArgument}>(0)</tspan></text><path d="M-24 -13h8m-2-2 2 2-2 2" className={styles.radiusAccent} /></g>
      <g data-displacement="SLabel" visibility="hidden" transform={translate(initial.displacement.label)}><text x="-20" className={styles.displacementLabel}>S<tspan data-displacement="displacementTime" dx="5" className={styles.timeArgument}>(0)</tspan></text><path d="M-20 -14h10m-2-2 2 2-2 2" className={styles.displacementAccent} /></g>
      <circle cx={start[0]} cy={start[1]} r="3.5" className={styles.start} />
      <text data-displacement="startLabel" visibility="hidden" x={initial.startLabel[0]} y={initial.startLabel[1]} className={styles.pointLabel}>M(0)</text>
      <g data-displacement="point" transform={translate(initial.point)}><circle r="5" className={styles.point} /><text data-displacement="pointName" x={initial.pointLabel[0]} y={initial.pointLabel[1]} textAnchor={initial.pointAnchor} className={styles.pointLabel}><tspan data-displacement="pointEquality" display="none">M<tspan className={styles.timeArgument}>(0) = </tspan></tspan>M<tspan data-displacement="pointTime" className={styles.timeArgument}>(0)</tspan></text></g>
    </svg>
    <div className={styles.readouts}>
      <span className={styles.pathReadout}><i>L</i> = <output ref={pathReadout} aria-label="Путь L" aria-live="off">0,00</output><small>м</small></span>
      <span className={styles.displacementReadout}><i>S</i> = <output ref={displacementReadout} aria-label="Модуль перемещения S" aria-live="off">0,00</output><small>м</small></span>
    </div>
    <LessonPlaybackControls demo="displacement" playback={playback} duration={DISPLACEMENT_DURATION} label="путь и перемещение" initial={format(0)} />
  </figure>;
}
