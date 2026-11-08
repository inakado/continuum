import { useId, type ReactNode } from 'react';
import { svgPath, svgVector } from '../curve-ribbon';
import type { Point2 } from '../point-position-model';
import { positionAt, screenPoint, speedView, velocityTip, type intervalAt } from './speed-model';
import styles from './speed-demo.module.css';

export type SpeedFrame = ReturnType<typeof intervalAt>;
const add = (a: Point2, b: Point2): Point2 => [a[0] + b[0], a[1] + b[1]];
export function normalOffset(a: Point2, b: Point2, distance: number): Point2 {
  const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
  return [-dy / n * distance, dx / n * distance];
}

export function Vector({ from, to, className, label, offset = 16, opacity = 1 }: {
  from: Point2; to: Point2; className: string; label?: string; offset?: number; opacity?: number;
}) {
  const vector = svgVector(from, to, offset);
  return <g className={className} opacity={opacity}>
    <path d={vector.vector} className={styles.vectorLine} />
    <path d={vector.arrow} className={styles.vectorTip} />
    {label && <VectorLabel at={vector.label} text={label} />}
  </g>;
}

export function VectorLabel({ at: [x, y], text }: { at: Point2; text: string }) {
  // Отдельная стрелка над символом не касается скобок и аргументов.
  const shift = text.startsWith('r') ? -3.6 * (text.length - 1) : text.startsWith('Δ') ? 4 : 0;
  return <g transform={`translate(${x} ${y})`} className={styles.vectorLabel}>
    <text textAnchor="middle">{text}</text>
    <path d={`M${shift - 5} -15h10m-3-2 3 2-3 2`} className={styles.accent} />
  </g>;
}

const fullCurve = svgPath(Array.from({ length: 261 }, (_, i) => screenPoint(positionAt(i * 12 / 260))));
export function curveBetween(t: number, end: number) {
  return svgPath(Array.from({ length: 161 }, (_, i) => screenPoint(positionAt(t + (end - t) * i / 160))));
}

export default function SpeedScene({ frame, children, radii = true, average = true, chord = true, trail = true, fixedPoint = false, endpointLabel = true }: {
  frame: SpeedFrame; children?: ReactNode; radii?: boolean; average?: boolean; chord?: boolean; trail?: boolean; fixedPoint?: boolean; endpointLabel?: boolean;
}) {
  const id = useId(), a = screenPoint(frame.a), b = screenPoint(frame.b);
  const velocityBase = add(a, normalOffset(a, b, 19));
  const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const reveal = Math.max(0, Math.min(1, (distance - 24) / 35));
  return <svg className={styles.art} viewBox="0 0 600 440" role="img" aria-label="Траектория точки в системе координат X, Y, Z">
    <defs>
      <linearGradient id={`${id}-curve`} x1="150" y1="390" x2="320" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#9eb7d6" /><stop offset="1" stopColor="#445f92" /></linearGradient>
    </defs>
    <g className={styles.axes}>
      {([[25, 418], [496, 326], [130, 47]] as const).map((p, i) => <Vector key={i} from={speedView.origin} to={p} className={styles.axis} />)}
      <text x="16" y="436">X</text><text x="510" y="332">Y</text><text x="124" y="28">Z</text><text x="109" y="346">O</text>
    </g>
    <path d={fullCurve} className={styles.guide} />
    {trail && <path d={curveBetween(frame.t, frame.t + frame.dt)} className={styles.trail} stroke={`url(#${id}-curve)`} />}
    {radii && <>
      <Vector from={speedView.origin} to={a} className={styles.radius} label="r(t)" offset={24} />
      <Vector from={speedView.origin} to={b} className={styles.radius} label="r(t+Δt)" offset={-24} opacity={reveal} />
    </>}
    {chord && <Vector from={a} to={b} className={styles.chord} label="Δr" offset={-18} opacity={reveal} />}
    {average && <Vector from={velocityBase} to={velocityTip(velocityBase, frame.average)} className={styles.velocity} label="⟨υ⟩" offset={20} />}
    {children}
    <circle cx={a[0]} cy={a[1]} r="4.5" className={fixedPoint ? styles.point : styles.startPoint} />
    <circle cx={b[0]} cy={b[1]} r="5" className={fixedPoint ? styles.startPoint : styles.point} opacity={reveal} />
    <text x={a[0] + 12} y={a[1] + 24} className={styles.pointLabel}>M(t)</text>
    {endpointLabel && <text x={b[0] + 12} y={b[1] - 12} className={styles.pointLabel} opacity={reveal}>M(t+Δt)</text>}
  </svg>;
}
