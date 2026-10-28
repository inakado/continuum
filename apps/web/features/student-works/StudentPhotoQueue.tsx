import { Check, CircleAlert, Clock, LoaderCircle } from 'lucide-react';
import type { PhotoUploadItem } from './use-solution-photos';
import styles from './student-works.module.css';

const labels = { waiting: 'В очереди', uploading: 'Загружается…', uploaded: 'Загружено', error: 'Не загружено' };
const icons = { waiting: Clock, uploading: LoaderCircle, uploaded: Check, error: CircleAlert };

export default function StudentPhotoQueue({ items }: { items: PhotoUploadItem[] }) {
  if (!items.length) return null;
  const accepted = items.filter((item) => item.status === 'uploaded').length;
  return <div className={styles.uploadQueue}>
    <p role="status">Загружено файлов: {accepted} из {items.length}</p>
    <ol aria-label="Очередь загрузки фотографий">{items.map((item) => {
      const Icon = icons[item.status];
      return <li key={item.id} data-status={item.status}>
        <Icon size={17} aria-hidden="true" />
        <div><span className={styles.uploadName}>{item.name}</span>{item.error && <p className={styles.uploadError}>{item.error}</p>}</div>
        <span className={styles.uploadState}>{labels[item.status]}</span>
      </li>;
    })}</ol>
  </div>;
}
