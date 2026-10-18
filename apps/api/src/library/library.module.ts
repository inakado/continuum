import { Module } from '@nestjs/common';
import { ObjectStorageModule } from '../infra/storage/object-storage.module';
import { LibraryReadService } from './library-read.service';
import { LibraryWriteService } from './library-write.service';
import { StudentLibraryController } from './student-library.controller';
import { TeacherLibraryController } from './teacher-library.controller';
import { LibraryDeleteService } from './library-delete.service';
import { LibraryAssetCleanupService } from './library-asset-cleanup.service';

@Module({
  imports: [ObjectStorageModule],
  controllers: [StudentLibraryController, TeacherLibraryController],
  providers: [LibraryReadService, LibraryWriteService, LibraryDeleteService, LibraryAssetCleanupService],
})
export class LibraryModule {}
