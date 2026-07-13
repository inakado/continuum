const isProduction = () =>
  (process.env.NODE_ENV || process.env.APP_ENV || '').toLowerCase() === 'production';

export const resolveWorkerInternalToken = () => {
  const token = process.env.WORKER_INTERNAL_TOKEN?.trim();
  if (token) return token;
  if (isProduction()) {
    throw new Error('WORKER_INTERNAL_TOKEN must be set in production.');
  }
  return 'continuum-internal-dev';
};
