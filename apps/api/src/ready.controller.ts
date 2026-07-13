import { Controller, Get, Inject, Res } from '@nestjs/common';
import { type Response } from 'express';
import { AllowAnonymous } from './auth/decorators/allow-anonymous.decorator';
import { ReadyService } from './ready.service';

@Controller()
@AllowAnonymous()
export class ReadyController {
  constructor(@Inject(ReadyService) private readonly readyService: ReadyService) {}

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const result = await this.readyService.check();
    if (!result.ok) {
      res.status(503);
    }
    return {
      status: result.ok ? 'ok' : 'error',
      details: result.details,
    };
  }
}
