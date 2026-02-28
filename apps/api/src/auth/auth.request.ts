import { type Request } from 'express';
import { type AuthUser } from './auth.types';

export type AuthRequest = Request & { user: AuthUser };
