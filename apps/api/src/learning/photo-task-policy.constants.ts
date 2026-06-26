export const PHOTO_FILES_MIN = 1;
export const PHOTO_FILES_MAX = 5;

export const PHOTO_MAX_SIZE_BYTES = 20 * 1024 * 1024;
export const BOARD_JSON_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const BOARD_PREVIEW_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const PHOTO_ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const BOARD_JSON_CONTENT_TYPE = 'application/json';
export const BOARD_PREVIEW_CONTENT_TYPE = 'image/png';

export const PHOTO_UPLOAD_TTL_DEFAULT_SEC = 300;
export const PHOTO_VIEW_TTL_STUDENT_DEFAULT_SEC = 180;
export const PHOTO_VIEW_TTL_TEACHER_DEFAULT_SEC = 600;
export const PHOTO_TTL_MAX_SEC = 600;
