import { Body, Controller, Delete, Get, Header, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  BulkCreateStudentsInputSchema, ResourceIdParamsSchema, SchoolClassInputSchema, UpdateSchoolClassInputSchema,
  DeleteSchoolClassInputSchema,
  type BulkCreateStudentsInput, type ResourceIdParams, type SchoolClassInput, type UpdateSchoolClassInput,
} from '@continuum/shared';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SchoolClassesReadService } from './school-classes-read.service';
import { SchoolClassesWriteService } from './school-classes-write.service';

@Controller('teacher/classes')
@UseGuards(RolesGuard)
@Roles(Role.teacher)
export class TeacherClassesController {
  constructor(
    @Inject(SchoolClassesReadService) private readonly reads: SchoolClassesReadService,
    @Inject(SchoolClassesWriteService) private readonly writes: SchoolClassesWriteService,
  ) {}
  @Get()
  getClasses(@Req() request: AuthRequest) { return this.reads.getClasses(request.user.id); }

  @Post()
  createClass(@Req() request: AuthRequest, @Body(new ZodValidationPipe(SchoolClassInputSchema)) input: SchoolClassInput) {
    return this.writes.createClass(request.user.id, input);
  }
  @Patch(':id')
  updateClass(@Req() request: AuthRequest, @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
    @Body(new ZodValidationPipe(UpdateSchoolClassInputSchema)) input: UpdateSchoolClassInput) {
    return this.writes.updateClass(request.user.id, params.id, input);
  }
  @Post('students')
  @Header('Cache-Control', 'no-store')
  createStudents(@Req() request: AuthRequest, @Body(new ZodValidationPipe(BulkCreateStudentsInputSchema)) input: BulkCreateStudentsInput) {
    return this.writes.createStudents(request.user.id, input);
  }

  @Delete(':id')
  deleteClass(@Req() request: AuthRequest, @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
    @Body(new ZodValidationPipe(DeleteSchoolClassInputSchema)) input: { deleteStudents: boolean }) {
    return this.writes.deleteClass(request.user.id, params.id, input.deleteStudents);
  }
}
