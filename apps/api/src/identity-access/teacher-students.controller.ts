import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  CreateTeacherStudentInputSchema,
  ResourceIdParamsSchema,
  SetStudentActiveInputSchema,
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

@Controller('teacher/students')
@UseGuards(RolesGuard)
@Roles(Role.teacher)
export class TeacherStudentsController {
  constructor(
    @Inject(IdentityAccessReadService) private readonly reads: IdentityAccessReadService,
    @Inject(IdentityAccessWriteService) private readonly writes: IdentityAccessWriteService,
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
}
