import { ApiError } from '@/lib/api/client';

export function apiErrorMessage(error: unknown, fallback = 'Не удалось загрузить данные. Повторите попытку.') {
  return error instanceof ApiError ? error.message : fallback;
}
