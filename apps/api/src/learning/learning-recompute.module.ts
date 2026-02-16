import { Module } from '@nestjs/common';
import { LearningAvailabilityService } from './learning-availability.service';
import { LearningRecomputeService } from './learning-recompute.service';

@Module({
  providers: [LearningAvailabilityService, LearningRecomputeService],
  exports: [LearningAvailabilityService, LearningRecomputeService],
})
export class LearningRecomputeModule {}

