import { Controller, Get } from '@nestjs/common';
import { sharedVersion } from '@continuum/shared';
import { AllowAnonymous } from './auth/decorators/allow-anonymous.decorator';

@Controller()
@AllowAnonymous()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', sharedVersion };
  }
}
