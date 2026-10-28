import { apiErrorMessage } from '@/lib/api/error-message';
import type { StudentSolutionPhotos } from './use-solution-photos';
import styles from './student-works.module.css';

export default function StudentPhotoFeedback({ photos, taskId }: { photos: StudentSolutionPhotos; taskId?: string }) {
  const error = photos.error ?? photos.readError;
  const uploadFailed = photos.uploads.some((item) => item.status === 'error');
  if (!error) return null;
  if (uploadFailed !== Boolean(taskId) || (taskId && photos.pendingTaskId !== taskId)) return null;
  return <div className={taskId ? styles.photoFeedback : styles.error} role="alert">{(!taskId || photos.readError) && <p>{apiErrorMessage(error, 'Не удалось сохранить фото. Уже загруженные фотографии не изменены.')}</p>}
    <p>Уже принятые фото сохранены. Незагруженные файлы остаются в этой вкладке; повтор продолжит очередь.</p>
    <div className={styles.dialogActions}><button className={styles.textButton} disabled={photos.busy || photos.refreshing} onClick={() => { void photos.retry(); }}>Обновить фото и повторить</button>
      {photos.pending && !photos.busy && <button className={styles.textButton} onClick={photos.discard}>Убрать незагруженные</button>}
    </div>
  </div>;
}
