import { Module } from '@nestjs/common';
import { OBJECT_STORAGE_CONFIG, resolveObjectStorageConfig } from './object-storage.config';
import { ObjectStorageService } from './object-storage.service';

@Module({
  providers: [
    {
      provide: OBJECT_STORAGE_CONFIG,
      useFactory: resolveObjectStorageConfig,
    },
    ObjectStorageService,
  ],
  exports: [ObjectStorageService],
})
export class ObjectStorageModule {}
