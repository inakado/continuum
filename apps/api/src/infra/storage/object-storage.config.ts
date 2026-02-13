import { resolveStorageConfigFromEnv, type StorageCoreConfig } from '@continuum/shared';

export const OBJECT_STORAGE_CONFIG = Symbol('OBJECT_STORAGE_CONFIG');

export type ObjectStorageConfig = StorageCoreConfig;

export const resolveObjectStorageConfig = (): ObjectStorageConfig =>
  resolveStorageConfigFromEnv(process.env as Record<string, string | undefined>);
