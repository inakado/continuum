import { type Role } from '@prisma/client';

export type AuthUser = {
  id: string;
  login: string;
  role: Role;
};
