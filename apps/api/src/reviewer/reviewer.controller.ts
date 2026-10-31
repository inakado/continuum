import { Body, Controller, Get, Header, Headers, Inject, Param, ParseUUIDPipe, Post, Put, Query, Req, StreamableFile } from '@nestjs/common';
import { z } from 'zod';
import { ReviewerDraftSchema, ReviewerListQuerySchema, ReviewerPublicationSchema, ReviewerReportCreateSchema, type ReviewerDraft, type ReviewerListQuery, type ReviewerPublication, type ReviewerReportCreate } from '@continuum/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ReviewerAccess, type ReviewerRequest } from './reviewer-auth.service';
import { ReviewerReadService } from './reviewer-read.service';
import { ReviewerWriteService } from './reviewer-write.service';

@Controller('reviewer/v1')
@ReviewerAccess('read')
export class ReviewerController {
  constructor(@Inject(ReviewerReadService) private readonly reads: ReviewerReadService, @Inject(ReviewerWriteService) private readonly writes: ReviewerWriteService) {}
  @Get('me') @Header('Cache-Control', 'no-store') me(@Req() req: ReviewerRequest) { const p = req.reviewer; return { ...p, expiresAt: p.expiresAt?.toISOString() ?? null }; }
  @Get('assignments') @Header('Cache-Control', 'no-store') assignments(@Req() req: ReviewerRequest, @Query(new ZodValidationPipe(ReviewerListQuerySchema)) query: ReviewerListQuery) { return this.reads.assignments(req.reviewer, query); }
  @Get('assignments/:id/solutions') @Header('Cache-Control', 'no-store') solutions(@Req() req: ReviewerRequest, @Param('id', new ParseUUIDPipe()) id: string, @Query(new ZodValidationPipe(ReviewerListQuerySchema)) query: ReviewerListQuery) { return this.reads.list(req.reviewer, id, query); }
  @Get('solutions/:id') @Header('Cache-Control', 'no-store') detail(@Req() req: ReviewerRequest, @Param('id', new ParseUUIDPipe()) id: string) { return this.reads.detail(req.reviewer, id); }
  @Get('solutions/:id/photos/:photoId') @Header('Cache-Control', 'no-store') async photo(@Req() req: ReviewerRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('photoId', new ParseUUIDPipe()) photoId: string, @Query('sourceRevision', new ZodValidationPipe(z.coerce.number().int().positive())) revision: number) { const file = await this.reads.photo(req.reviewer, id, photoId, revision); return new StreamableFile(file.stream, { type: file.contentType }); }
  @Get('solutions/:id/images/:name') @Header('Cache-Control', 'no-store') async image(@Req() req: ReviewerRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('name') name: string) { const file = await this.reads.image(req.reviewer, id, name); return new StreamableFile(file.stream, { type: file.contentType }); }
  @Put('reports/:id') @ReviewerAccess('draft:write') @Header('Cache-Control', 'no-store') reserve(@Req() req: ReviewerRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(ReviewerReportCreateSchema)) input: ReviewerReportCreate) { return this.writes.reserveReport(req.reviewer, id, input); }
  @Put('reports/:id/file') @ReviewerAccess('draft:write') @Header('Cache-Control', 'no-store') upload(@Req() req: ReviewerRequest, @Param('id', new ParseUUIDPipe()) id: string, @Headers('content-type') type = '', @Headers('content-length') length?: string) { return this.writes.uploadReport(req.reviewer, id, req, type, length); }
  @Get('reports/:id/file') @Header('Cache-Control', 'no-store') async report(@Req() req: ReviewerRequest, @Param('id', new ParseUUIDPipe()) id: string) { const file = await this.reads.report(req.reviewer, id); return new StreamableFile(file.stream, { type: 'application/pdf', disposition: 'attachment; filename="review.pdf"' }); }
  @Put('solutions/:id/draft') @ReviewerAccess('draft:write') @Header('Cache-Control', 'no-store') draft(@Req() req: ReviewerRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(ReviewerDraftSchema)) input: ReviewerDraft) { return this.writes.draft(req.reviewer, id, input); }
  @Post('publications') @ReviewerAccess('publish') @Header('Cache-Control', 'no-store') publish(@Req() req: ReviewerRequest, @Body(new ZodValidationPipe(ReviewerPublicationSchema)) input: ReviewerPublication) { return this.writes.publish(req.reviewer, input); }
  @Get('publications/:id') @Header('Cache-Control', 'no-store') publication(@Req() req: ReviewerRequest, @Param('id', new ParseUUIDPipe()) id: string) { return this.writes.publication(req.reviewer, id); }
}
