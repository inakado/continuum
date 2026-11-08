import { useState } from 'react';
import styles from '@/components/assessment/assessment-content.module.css';

// Standalone packages have neither Next's image runtime nor authenticated image URLs.
export default function PackagedAssessmentImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return !failed && /^data:image\/(?:png|jpeg|webp|svg\+xml);/.test(src)
    ? <img src={src} alt={alt} className={styles.taskImage} onError={() => setFailed(true)} />
    : <span role="alert">Рисунок недоступен: {alt}</span>;
}
