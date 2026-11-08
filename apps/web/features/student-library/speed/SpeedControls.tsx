'use client';

import { speedNumber } from './speed-model';
import styles from './speed-demo.module.css';

export function DemoNumber({ number }: { number: number }) {
  return <span className={styles.number} aria-label={`Демонстрация ${number}`}>№ {number}</span>;
}
export function StartTime({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <label className={styles.parameter}><span>t</span><input type="range" min="0" max="4" step=".01" value={value} onChange={event => onChange(Number(event.currentTarget.value))} aria-label="Начальный момент t" /><output>{speedNumber(value)} с</output></label>;
}
