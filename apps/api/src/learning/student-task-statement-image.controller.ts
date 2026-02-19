import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TaskStatementImagePolicyService } from '../content/task-statement-image-policy.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { LearningService } from './learning.service';

@Controller('student/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.student)
export class StudentTaskStatementImageController {
  constructor(
    private readonly learningService: LearningService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly taskStatementImagePolicyService: TaskStatementImagePolicyService,
  ) {}

  @Get(':taskId/statement-image/presign-view')
  async presignView(
    @Param('taskId') taskId: string,
    @Req() req: AuthRequest,
    @Query('ttlSec') ttlRaw: string | undefined,
  ) {
    const ttlSec = this.taskStatementImagePolicyService.resolveViewTtl(Role.student, ttlRaw);
    const statementImage = await this.learningService.getTaskStatementImageAssetKeyForStudent(
      req.user.id,
      taskId,
    );
    const responseContentType = this.taskStatementImagePolicyService.inferResponseContentType(
      statementImage.key,
    );
    const url = await this.objectStorageService.presignGetObject(
      statementImage.key,
      ttlSec,
      responseContentType,
    );

    return {
      ok: true,
      taskId: statementImage.taskId,
      taskRevisionId: statementImage.taskRevisionId,
      key: statementImage.key,
      expiresInSec: ttlSec,
      url,
    };
  }
}
