import { isProductionEnvironment } from '../runtime/environment';

export const resolveWorkerInternalToken = () => {
  const token = process.env.WORKER_INTERNAL_TOKEN?.trim();
  if (token) return token;
  if (isProductionEnvironment()) {
    throw new Error('WORKER_INTERNAL_TOKEN must be set in production.');
  }
  return 'continuum-internal-dev';
};
