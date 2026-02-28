import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { type Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { type AuthUser, type JwtPayload } from '../auth.types';
import { resolveAuthCookieName, resolveJwtSecret } from '../auth.config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    const cookieName = resolveAuthCookieName();
    const cookieExtractor = (req: Request) => req?.cookies?.[cookieName] ?? null;
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    return this.authService.validateAccessPayload(payload);
  }
}
