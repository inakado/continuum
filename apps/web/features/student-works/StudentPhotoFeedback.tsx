import { apiErrorMessage } from '@/lib/api/error-message';
import type { StudentSolutionPhotos } from './use-solution-photos';
import styles from './student-works.module.css';

export default function StudentPhotoFeedback({ photos }: { photos: StudentSolutionPhotos }) {
  const error = photos.error ?? photos.readError;
  if (!error) return null;
  return <div className={styles.error} role="alert"><p>{apiErrorMessage(error, 'Не удалось сохранить фото. Уже загруженные фотографии не изменены.')}</p>
    <div className={styles.dialogActions}><button className={styles.textButton} disabled={photos.busy} onClick={() => { void photos.reload().then(() => photos.flush()); }}>Обновить фото и повторить</button>
      {photos.pending && !photos.busy && <button className={styles.textButton} onClick={photos.discard}>Отменить загрузку</button>}
    </div>
  </div>;
}
