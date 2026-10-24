"use client";

import { useRef, type RefObject } from 'react';
import { Search, X } from 'lucide-react';
import styles from './search-field.module.css';

type SearchFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
};

export default function SearchField({ label, value, onValueChange, placeholder, maxLength, disabled = false, className = '', inputRef }: SearchFieldProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  return <div className={`${styles.root} ${className}`}>
    <Search size={18} aria-hidden="true" />
    <input ref={ref} className={styles.input} type="search" aria-label={label} placeholder={placeholder} maxLength={maxLength} disabled={disabled} value={value} onChange={(event) => onValueChange(event.target.value)} />
    <button type="button" className={styles.clear} aria-label="Очистить поиск" disabled={disabled || !value} data-empty={!value || undefined} onClick={() => { onValueChange(''); ref.current?.focus(); }}><X size={16} aria-hidden="true" /></button>
  </div>;
}
