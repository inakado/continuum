import { Controller, Get } from '@nestjs/common';
import { sharedVersion } from '@continuum/shared';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', sharedVersion };
  }
}
