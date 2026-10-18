import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ObjectStorageModule } from '../infra/storage/object-storage.module';
import { ReviewerAuthService } from './reviewer-auth.service';
import { ReviewerKeysService } from './reviewer-keys.service';
import { ReviewerKeysController } from './reviewer-keys.controller';
import { ReviewerReadService } from './reviewer-read.service';
import { ReviewerWriteService } from './reviewer-write.service';
import { ReviewerController } from './reviewer.controller';

@Module({ imports: [PrismaModule, AuthModule, ObjectStorageModule], controllers: [ReviewerKeysController, ReviewerController], providers: [ReviewerAuthService, ReviewerKeysService, ReviewerReadService, ReviewerWriteService], exports: [ReviewerAuthService] })
export class ReviewerModule {}
