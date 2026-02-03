import { Role } from '@prisma/client';

export type AuthUser = {
  id: string;
  login: string;
  role: Role;
};

export type JwtPayload = {
  sub: string;
};
