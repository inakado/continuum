"use client";
import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { solutionPhotoPolicy, type SolutionAnswer } from '@continuum/shared';
import SolutionPhotoList from '@/components/assessment/SolutionPhotoList';
import styles from './teacher-works.module.css';

export default function WorkPreviewPhotos({ photos, onAdd, onRemove }: { photos: SolutionAnswer['photos']; onAdd: (files: File[]) => string | null; onRemove: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function choose(files: File[]) { setDragging(false); setError(onAdd(files)); }
  return <section className={styles.trialPhotos} aria-label="Фотографии решения">
    <div className={styles.trialPhotoHeading}><h3>Ваше решение</h3><span>{photos.length ? `Добавлено фото: ${photos.length}` : 'Фото ещё не добавлены'}</span></div>
    <input ref={input} type="file" aria-label="Выбрать фотографии решения" className={styles.srOnly} tabIndex={-1} accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { choose(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
    <SolutionPhotoList photos={photos} actions={(id, index) => <button type="button" className={styles.textButton} aria-label={`Удалить фото ${index + 1}`} onClick={() => { onRemove(id); setError(null); }}>Удалить</button>} />
    <div className={`${styles.trialPhotoDrop} ${dragging ? styles.trialPhotoDragging : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); choose(Array.from(event.dataTransfer.files)); }}>
      <ImagePlus size={22} aria-hidden="true" /><div><button type="button" className={styles.textButton} disabled={photos.length >= solutionPhotoPolicy.maxPhotos} onClick={() => input.current?.click()}>Добавить фото</button><span>или перетащите сюда</span><p>JPG, PNG или WebP · до 10 МБ · не более 10 фото</p></div>
    </div>
    <p className={styles.previewNote}>Пробные фото остаются на этом устройстве до закрытия предпросмотра.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
