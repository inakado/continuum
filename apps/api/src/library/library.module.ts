import { Module } from '@nestjs/common';
import { ObjectStorageModule } from '../infra/storage/object-storage.module';
import { LibraryReadService } from './library-read.service';
import { LibraryWriteService } from './library-write.service';
import { StudentLibraryController } from './student-library.controller';
import { TeacherLibraryController } from './teacher-library.controller';

@Module({
  imports: [ObjectStorageModule],
  controllers: [StudentLibraryController, TeacherLibraryController],
  providers: [LibraryReadService, LibraryWriteService],
})
export class LibraryModule {}
