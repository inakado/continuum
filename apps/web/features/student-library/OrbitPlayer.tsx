'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import { EARTH_YEAR, MOON_MONTH, ORBIT_EXAGGERATION, orbitAt, orbitPath, type OrbitFrame } from './orbit-model';
import { projectPoint, type PointView } from './point-position-model';
import { useLessonPlayback } from './useLessonPlayback';
import LessonPlaybackControls from './LessonPlaybackControls';
import styles from './trajectory.module.css';

const format = (days: number) => `${days.toFixed(1).replace('.', ',')} сут`;
type OrbitArt = { earth: ReactNode; moon: ReactNode; sun: ReactNode; view: PointView; width: number; height: number };

function OrbitScene({ frame, earth, moon, sun, view, width, height }: OrbitArt & { frame: OrbitFrame }) {
  const local = frame === 'earth', state = orbitAt(0);
  const earthPosition = local ? view.origin : projectPoint(state.earth, view);
  const moonPosition = projectPoint(local ? state.relativeMoon : state.moon, view);
  return <div className={styles.orbitScene} data-orbit-scene={frame}>
    <h3>{local ? 'Относительно Земли' : 'Относительно Солнца'}</h3>
    <svg className={styles.orbitArt} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={local ? 'Земля неподвижна, Луна описывает окружность' : 'Земля и Луна движутся вокруг Солнца; траектория Луны отклоняется от орбиты Земли'}>
      <path d={orbitPath(local ? MOON_MONTH : EARTH_YEAR, frame, view, 'earth')} className={local ? styles.orbitGuide : styles.earthOrbit} />
      <path data-orbit-trail={frame} d={orbitPath(0, frame, view)} className={styles.orbitTrail} />
      {!local && <g transform={`translate(${view.origin[0]} ${view.origin[1]})`}><g className={styles.sun} transform="scale(21)">{sun}</g><text y="42" textAnchor="middle" className={styles.bodyLabel}>Солнце</text></g>}
      <g data-orbit-earth={frame} transform={`translate(${earthPosition[0]} ${earthPosition[1]})`}>
        <g transform={`scale(${local ? 27 : 4})`}>{earth}</g>
        <text y={local ? 48 : 22} textAnchor="middle" className={styles.bodyLabel}>Земля</text>
      </g>
      <g data-orbit-moon={frame} transform={`translate(${moonPosition[0]} ${moonPosition[1]})`}>
        <g className={styles.moon} transform={`scale(${local ? 8 : 2.5})`}>{moon}</g>
        <text y="-14" textAnchor="middle" className={styles.bodyLabel}>Луна</text>
      </g>
    </svg>
  </div>;
}

export default function OrbitPlayer(art: OrbitArt) {
  const scenes = useRef<HTMLDivElement>(null);
  const paint = useCallback((days: number) => {
    const state = orbitAt(days);
    for (const frame of ['earth', 'sun'] as const) {
      const moon = projectPoint(frame === 'earth' ? state.relativeMoon : state.moon, art.view);
      const earth = frame === 'earth' ? art.view.origin : projectPoint(state.earth, art.view);
      scenes.current?.querySelector(`[data-orbit-moon="${frame}"]`)?.setAttribute('transform', `translate(${moon[0]} ${moon[1]})`);
      scenes.current?.querySelector(`[data-orbit-earth="${frame}"]`)?.setAttribute('transform', `translate(${earth[0]} ${earth[1]})`);
      scenes.current?.querySelector(`[data-orbit-trail="${frame}"]`)?.setAttribute('d', orbitPath(days, frame, art.view));
    }
  }, [art.view]);
  const playback = useLessonPlayback(EARTH_YEAR, EARTH_YEAR / 36, paint, format);
  return <figure id="moon-trajectory-demo" ref={playback.root} className={styles.orbitFigure} aria-label="Одна Луна, два тела отсчёта; время общее">
    <div ref={scenes} className={styles.orbitScenes}><OrbitScene {...art} frame="earth" /><OrbitScene {...art} frame="sun" /></div>
    <LessonPlaybackControls demo="moon" playback={playback} duration={EARTH_YEAR} label="Земля и Луна" initial={format(0)} />
    <figcaption className={styles.caption}>Размеры тел условны. В схеме относительно Солнца расстояние от Земли до Луны увеличено в {ORBIT_EXAGGERATION} раз.</figcaption>
  </figure>;
}
