import { Controller, Get, Req } from '@nestjs/common';
import type { AuthRequest } from './auth.request';

@Controller('me')
export class AuthMeController {
  @Get()
  getMe(@Req() request: AuthRequest) {
    return { user: request.user };
  }
}
