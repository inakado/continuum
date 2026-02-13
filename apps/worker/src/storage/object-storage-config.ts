import {
  resolveStorageConfigFromEnv,
  type StorageCoreConfig,
} from '@continuum/shared';

export type WorkerObjectStorageConfig = StorageCoreConfig;

export const resolveWorkerObjectStorageConfig = (): WorkerObjectStorageConfig =>
  resolveStorageConfigFromEnv(process.env as Record<string, string | undefined>);
