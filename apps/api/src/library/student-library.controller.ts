import { Controller, Get, Inject, Param, Req, UseGuards } from '@nestjs/common';
import { ResourceIdParamsSchema, type ResourceIdParams } from '@continuum/shared';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LibraryReadService } from './library-read.service';

@Controller('student/library')
@UseGuards(RolesGuard)
@Roles(Role.student)
export class StudentLibraryController {
  constructor(@Inject(LibraryReadService) private readonly reads: LibraryReadService) {}

  @Get()
  getLibrary(@Req() request: AuthRequest) {
    return this.reads.getStudentLibrary(request.user.id);
  }

  @Get('lessons/:id')
  getLesson(
    @Req() request: AuthRequest,
    @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
  ) {
    return this.reads.getStudentLesson(request.user.id, params.id);
  }
}
