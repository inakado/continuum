import { ForbiddenException } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.request';

export function assertWriteOrigin(request: AuthRequest) {
  const origin = request.headers.origin;
  const allowed = (process.env.CORS_ORIGIN || process.env.WEB_ORIGIN || `http://localhost:${process.env.WEB_PORT || 3001}`).split(',').map((value) => value.trim());
  if (origin && !allowed.includes(origin)) throw new ForbiddenException('Источник запроса не разрешён.');
}
