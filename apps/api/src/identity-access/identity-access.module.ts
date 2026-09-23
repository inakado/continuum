import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdentityAccessReadService } from './identity-access-read.service';
import { IdentityAccessWriteService } from './identity-access-write.service';
import { TeacherStudentsController } from './teacher-students.controller';

@Module({
  imports: [AuthModule],
  controllers: [TeacherStudentsController],
  providers: [IdentityAccessReadService, IdentityAccessWriteService],
})
export class IdentityAccessModule {}
