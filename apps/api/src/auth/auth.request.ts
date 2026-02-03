import { Request } from 'express';
import { AuthUser } from './auth.types';

export type AuthRequest = Request & { user: AuthUser };
