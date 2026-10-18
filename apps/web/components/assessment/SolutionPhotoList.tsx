"use client";
import { useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import type { SolutionAnswer } from '@continuum/shared';
import Dialog from '@/components/ui/Dialog';
import styles from './solution-photos.module.css';

const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
export default function SolutionPhotoList({ photos, actions }: { photos: SolutionAnswer['photos']; actions?: (id: string, index: number) => ReactNode }) {
  const [opened, setOpened] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const close = () => { setOpened(null); requestAnimationFrame(() => trigger.current?.focus()); };
  const photo = photos.find((item) => item.id === opened);
  return <>
    {photos.length > 0 && <ol className={styles.photos}>{photos.map((item, index) => <li key={item.id}>
      <button type="button" className={styles.thumbnail} onClick={(event) => { trigger.current = event.currentTarget; setOpened(item.id); }} aria-label={`Открыть фото ${index + 1}`}>
        <Image src={`${base}${item.url}`} crossOrigin="use-credentials" unoptimized width={240} height={180} alt={`Фото решения ${index + 1}`} />
      </button>
      <div className={styles.caption}><span>Фото {index + 1}</span>{actions?.(item.id, index)}</div>
    </li>)}</ol>}
    <Dialog open={Boolean(photo)} onOpenChange={(value) => { if (!value) close(); }} title={<span className={styles.viewerHeading}>Фото решения<button type="button" className={styles.close} onClick={close}>Закрыть</button></span>} className={styles.viewer} overlayClassName={styles.photoOverlay}>
      {photo && <Image src={`${base}${photo.url}`} crossOrigin="use-credentials" unoptimized width={1200} height={1600} alt="Фото решения в полном размере" className={styles.fullPhoto} />}
    </Dialog>
  </>;
}
