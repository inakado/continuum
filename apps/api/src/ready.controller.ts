import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReadyService } from './ready.service';

@Controller()
export class ReadyController {
  constructor(private readonly readyService: ReadyService) {}

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
