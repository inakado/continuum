import { Body, Controller, Delete, Get, Header, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  CreateTeacherStudentInputSchema,
  ResourceIdParamsSchema,
  SetStudentActiveInputSchema,
  SetStudentClassInputSchema,
  ResetStudentPasswordInputSchema,
  UpdateStudentNamesInputSchema,
  type UpdateStudentNamesInput,
  type CreateTeacherStudentInput,
  type ResourceIdParams,
  type SetStudentActiveInput,
} from '@continuum/shared';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { IdentityAccessReadService } from './identity-access-read.service';
import { IdentityAccessWriteService } from './identity-access-write.service';
import { SchoolClassesWriteService } from './school-classes-write.service';
import { assertWriteOrigin } from '../common/assert-write-origin';

@Controller('teacher/students')
@UseGuards(RolesGuard)
@Roles(Role.teacher)
export class TeacherStudentsController {
  constructor(
    @Inject(IdentityAccessReadService) private readonly reads: IdentityAccessReadService,
    @Inject(IdentityAccessWriteService) private readonly writes: IdentityAccessWriteService,
    @Inject(SchoolClassesWriteService) private readonly classes: SchoolClassesWriteService,
  ) {}

  @Get()
  getStudents(@Req() request: AuthRequest) {
    return this.reads.getStudents(request.user.id);
  }

  @Post()
  createStudent(
    @Req() request: AuthRequest,
    @Body(new ZodValidationPipe(CreateTeacherStudentInputSchema)) input: CreateTeacherStudentInput,
  ) {
    return this.writes.createStudent(request.user.id, input);
  }

  @Patch(':id/active')
  setStudentActive(
    @Req() request: AuthRequest,
    @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
    @Body(new ZodValidationPipe(SetStudentActiveInputSchema)) input: SetStudentActiveInput,
  ) {
    return this.writes.setStudentActive(request.user.id, params.id, input);
  }

  @Patch(':id/names')
  @Header('Cache-Control', 'no-store')
  updateNames(@Req() request: AuthRequest, @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
    @Body(new ZodValidationPipe(UpdateStudentNamesInputSchema)) input: UpdateStudentNamesInput) {
    assertWriteOrigin(request);
    return this.writes.updateStudentNames(params.id, input);
  }

  @Patch(':id/class')
  setClass(@Req() request: AuthRequest, @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
    @Body(new ZodValidationPipe(SetStudentClassInputSchema)) input: { classId: string | null }) {
    return this.classes.setStudentClass(request.user.id, params.id, input.classId);
  }

  @Post(':id/password-reset')
  @Header('Cache-Control', 'no-store')
  resetPassword(@Req() request: AuthRequest, @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams,
    @Body(new ZodValidationPipe(ResetStudentPasswordInputSchema)) input: { requestId: string }) {
    return this.classes.resetPassword(request.user.id, params.id, input.requestId);
  }

  @Delete(':id')
  deleteStudent(@Req() request: AuthRequest, @Param(new ZodValidationPipe(ResourceIdParamsSchema)) params: ResourceIdParams) {
    return this.classes.deleteStudent(request.user.id, params.id);
  }
}
