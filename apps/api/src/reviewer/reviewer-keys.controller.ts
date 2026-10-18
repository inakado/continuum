import { Body, Controller, Delete, Get, Header, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ReviewerKeyCreateSchema, type ReviewerKeyCreate } from '@continuum/shared';
import type { AuthRequest } from '../auth/auth.request';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { assertWriteOrigin } from '../common/assert-write-origin';
import { ReviewerKeysService } from './reviewer-keys.service';

@Controller('teacher/reviewer-access')
@UseGuards(RolesGuard)
@Roles('teacher')
export class ReviewerKeysController {
  constructor(@Inject(ReviewerKeysService) private readonly service: ReviewerKeysService) {}
  @Get('keys') @Header('Cache-Control', 'no-store') keys(@Req() req: AuthRequest) { return this.service.list(req.user.id); }
  @Post('keys') @Header('Cache-Control', 'no-store') create(@Req() req: AuthRequest, @Body(new ZodValidationPipe(ReviewerKeyCreateSchema)) input: ReviewerKeyCreate) { assertWriteOrigin(req); return this.service.create(req.user.id, input); }
  @Delete('keys/:id') @Header('Cache-Control', 'no-store') revoke(@Req() req: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) { assertWriteOrigin(req); return this.service.revoke(req.user.id, id); }
  @Get('targets') @Header('Cache-Control', 'no-store') targets() { return this.service.targets(); }
}
