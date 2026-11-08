'use client';

import { useId, type ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { materialPointCaption, materialPointFrame, type MaterialPointLayout } from './material-point-model';
import type { PointView } from './point-position-model';
import { useMaterialPoint } from './useMaterialPoint';
import styles from './material-point.module.css';
import { DemoNumber } from './LessonDemonstration';

export default function MaterialPointPlayer({ track, carriage, back, front, layout, view }: {
  track: ReactNode; carriage: ReactNode; back: ReactNode; front: ReactNode;
  layout: MaterialPointLayout; view: PointView;
}) {
  const model = useMaterialPoint(layout, view);
  const id = useId();
  const initial = materialPointFrame('motion', 0, layout.opening.initial, layout, view);
  return (
    <figure id="material-point-demo" ref={model.root} className={styles.figure} data-material-point data-mode={model.mode} data-abstracted={model.abstracted} aria-label="Одна каретка — разные задачи и выбор модели">
      <div className={styles.choices} role="group" aria-label="Что нужно узнать о каретке">
        <button type="button" aria-pressed={model.mode === 'motion'} onClick={() => model.choose('motion')}>Как перемещается каретка?</button>
        <button type="button" aria-pressed={model.mode === 'aperture'} onClick={() => model.choose('aperture')}>Пройдёт ли в проём?</button>
      </div>
      <div className={styles.scene}>
        <svg className={styles.art} viewBox="0 25 900 250" role="img" aria-label={model.mode === 'motion' ? 'При заданном поступательном движении точка перемещается вместе с кареткой. Размеры каретки можно опустить.' : 'Каретка проезжает через широкий проём; в узком касается стоек и откатывается. При равной ширине останавливается без зазора.'}>
          <defs>
            <linearGradient id={id}><stop offset="0%" stopColor="#D7E2F5" /><stop offset="100%" stopColor="#445F92" /></linearGradient>
          </defs>
          {track}
          <g ref={model.back} className={`${styles.gate} ${styles.backClear}`}>{back}</g>
          <g ref={model.carriage} className={styles.cartBody} data-material-carriage transform={`translate(${initial.translation.join(' ')})`}>{carriage}</g>
          <path ref={model.trail} className={styles.trail} stroke={`url(#${id})`} d={initial.trail} />
          <circle ref={model.point} data-material-marker className={styles.point} cx={initial.point[0]} cy={initial.point[1]} r="4" />
          <g ref={model.backBlocked} className={`${styles.gate} ${styles.backBlocked}`}>{back}</g>
          <g ref={model.front} className={styles.gate}>{front}</g>
          <g className={styles.gate}>
            {[initial.beam.top, initial.beam.side, initial.beam.front].map((d, i) => <path key={i} ref={(node) => { model.beam.current[i] = node; }} className={styles[`beam${i}`]} d={d} />)}
          </g>
          <g className={styles.dimensions}>
            <path ref={model.openingMeasure} d={initial.openingLine} />
          </g>
        </svg>
      </div>
      <div className={styles.controls}>
        <DemoNumber demo="material" />
        <button type="button" className={styles.play} onClick={model.toggle} aria-label={model.playing ? 'Приостановить движение модели' : model.finished ? 'Повторить движение модели' : 'Запустить движение модели'}>
          {model.playing ? <Pause size={17} /> : model.finished ? <RotateCcw size={17} /> : <Play size={17} />}
        </button>
        {model.mode === 'aperture' && <>
          <label htmlFor={`${id}-opening`}>Проём</label>
          <input ref={model.input} id={`${id}-opening`} type="range" min={layout.opening.min} max={layout.opening.max} step="1" defaultValue={layout.opening.initial} onChange={(event) => model.changeOpening(Number(event.currentTarget.value))} />
          <output ref={model.output} htmlFor={`${id}-opening`} aria-live="off">{(layout.opening.initial / layout.worldUnitsPerMetre).toFixed(2).replace('.', ',')} м</output>
        </>}
      </div>
      <figcaption ref={model.caption} className={styles.caption} aria-live="polite">{materialPointCaption('motion', layout.opening.initial, layout)}</figcaption>
    </figure>
  );
}
