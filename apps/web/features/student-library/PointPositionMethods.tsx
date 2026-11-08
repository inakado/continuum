'use client';

import { useId, type ReactNode } from 'react';
import { LessonInlineMath } from './LessonEquation';
import { DemoNumber, DemoReference, lessonDemonstrations } from './LessonDemonstration';
import { INITIAL_POINT, POINT_LIMIT, pointFrame, pointNumber, type Point2, type PointView } from './point-position-model';
import { usePointPosition, type PointController } from './usePointPosition';
import { usePointScene } from './usePointScene';
import styles from './point-position.module.css';

type SceneArt = { axes: ReactNode; view: PointView; labels: readonly Point2[]; width: number; height: number };

function PointScene({ mode, controller, axes, view, labels, width, height }: SceneArt & { mode: 'coordinates' | 'vector'; controller: PointController }) {
  const id = useId();
  const events = usePointScene(controller, view, width, height);
  const frame = pointFrame(INITIAL_POINT, view);
  const position = ([x, y]: Point2) => ({ left: `${100 * x / width}%`, top: `${100 * y / height}%` });
  const vector = mode === 'vector';
  return (
    <figure id={lessonDemonstrations[vector ? 'vector' : 'coordinates'].id} ref={events.root} className={styles.figure} data-point-scene={mode} aria-label={vector ? 'Векторный способ задания положения точки' : 'Координатный способ задания положения точки'}>
      <div className={styles.drawing}>
        <svg className={styles.art} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={vector ? 'Радиус-вектор из O в M и углы с положительными осями X, Y и Z' : 'Точка M, три координатные оси и ортогональные проекции точки'}>
          <path data-point-path="plane" className={styles.plane} d={frame.plane} />
          {axes}
          <path data-point-path="projections" className={styles.projections} d={frame.projections} />
          {vector ? <>
            {frame.arcs.map((d, i) => <path key={i} data-point-path={`arc${i}`} className={`${styles.angle} ${styles[`angle${i}`]}`} d={d} />)}
            <path data-point-path="vector" className={styles.radius} d={frame.vector} />
            <path data-point-path="arrow" className={styles.arrow} d={frame.arrow} />
          </> : frame.coordinatePaths.map((d, i) => <path key={i} data-point-path={['x', 'y', 'z'][i]} className={styles.coordinate} d={d} />)}
          {frame.feet.map(([cx, cy], i) => <circle key={i} data-point-foot={i} className={styles.foot} cx={cx} cy={cy} r="3" />)}
        </svg>
        {labels.map((p, i) => <span key={i} data-angle-obstacle className={`${styles.axisLabel} ${styles[`axis${i}`]}`} style={position(p)} aria-hidden="true">{['X', 'Y', 'Z'][i]}</span>)}
        <span data-angle-obstacle className={styles.origin} style={position(view.origin)} aria-hidden="true">O</span>
        {vector && <span data-angle-obstacle data-vector-label className={styles.vectorLabel} style={position(frame.vectorLabel)} aria-hidden="true">r</span>}
        {vector && ['x', 'y', 'z'].map((axis, i) => <span key={axis} data-angle-label={i} className={`${styles.angleLabel} ${styles[`angle${i}`]}`} hidden aria-hidden="true">α<sub>{axis}</sub></span>)}
        {([0, 1, 2] as const).map((axis) => <button key={axis} type="button" role="slider" data-point-axis={axis}
          className={styles.axisHandle} style={position(frame.feet[axis])}
          aria-label={`Координата ${['X', 'Y', 'Z'][axis]}: ${vector ? 'векторный' : 'координатный'} способ`}
          aria-valuemin={0} aria-valuemax={POINT_LIMIT} aria-valuenow={INITIAL_POINT[axis]} aria-valuetext={`${pointNumber(INITIAL_POINT[axis])} м`}
          aria-describedby={`${id}-hint`}
          onPointerDown={(event) => events.onPointerDown(event, axis)} onPointerMove={events.onPointerMove} onPointerUp={events.onPointerUp} onPointerCancel={events.onPointerCancel} onLostPointerCapture={events.onLostPointerCapture}
          onKeyDown={(event) => events.onKeyDown(event, axis)} />)}
        <button type="button" data-point-handle className={styles.pointHandle} style={position(frame.point)}
          aria-label={`Точка M: ${vector ? 'векторный' : 'координатный'} способ. Тяни вверх и вниз для изменения высоты; Shift с перетаскиванием — плоскость XY. Стрелки меняют X и Y; Shift со стрелками вверх и вниз — Z. Home — исходное положение.`}
          aria-describedby={`${id}-readout ${id}-hint`}
          onPointerDown={events.onPointerDown} onPointerMove={events.onPointerMove} onPointerUp={events.onPointerUp} onPointerCancel={events.onPointerCancel} onLostPointerCapture={events.onLostPointerCapture} onKeyDown={events.onKeyDown}
          onClick={(event) => { if (event.detail === 0) controller.set(INITIAL_POINT); }}>
          <span className={styles.pointDot} /><span data-angle-obstacle className={styles.pointName} aria-hidden="true">M</span>
        </button>
      </div>
      <div id={`${id}-readout`} className={vector ? styles.vectorReadout : styles.coordinateReadout}>
        {vector ? <>
          <span><i>r</i> = <output data-point-value="length" aria-live="off">{pointNumber(frame.length)}</output><small>м</small></span>
          {frame.angles.map((angle, i) => <span key={i} className={styles[`angle${i}`]}><i>α<sub>{['x', 'y', 'z'][i]}</sub></i> = <output data-point-value={`angle${i}`} aria-live="off">{angle === null ? '—' : `${angle.toFixed(1).replace('.', ',')}°`}</output></span>)}
        </> : INITIAL_POINT.map((value, i) => <span key={i}><i>{['x', 'y', 'z'][i]}</i> = <output data-point-value={['x', 'y', 'z'][i]} aria-live="off">{pointNumber(value)}</output><small>м</small></span>)}
      </div>
      <figcaption id={`${id}-hint`} className={styles.hint}><DemoNumber demo={vector ? 'vector' : 'coordinates'} /> · <span data-point-hint>Тяни M или её проекции на осях</span></figcaption>
      <span data-point-status className={styles.srOnly} aria-live="polite" />
    </figure>
  );
}

export default function PointPositionMethods(art: SceneArt) {
  const controller = usePointPosition();
  return (
    <section className={styles.section} aria-labelledby="point-position-title">
      <h2 id="point-position-title" data-lesson-section>Как задать положение точки</h2>
      <p>В первую очередь научимся задавать положение точки в выбранной системе отсчёта. Положение точки можно задавать двумя равносильными способами.</p>
      <h3>Координатный способ</h3>
      <p>Определяются координаты <LessonInlineMath tex="x" />, <LessonInlineMath tex="y" />, <LessonInlineMath tex="z" /> точки, которые равны расстояниям (с учётом знака) от этой точки до координатных плоскостей <LessonInlineMath tex="YOZ" />, <LessonInlineMath tex="XOZ" />, <LessonInlineMath tex="XOY" /> соответственно (<DemoReference demo="coordinates" />).</p>
      <PointScene {...art} mode="coordinates" controller={controller} />
      <h3>Векторный способ</h3>
      <p>Проводится направленный отрезок (вектор) <LessonInlineMath tex={String.raw`\vec r=\overrightarrow{OM}`} /> из начала координат <LessonInlineMath tex="O" /> в точку <LessonInlineMath tex="M" /> (<DemoReference demo="vector" />), который называется <em>радиус-вектором точки</em>.</p>
      <PointScene {...art} mode="vector" controller={controller} />
    </section>
  );
}
