import { type Role } from '@prisma/client';

export type PublicUser = {
  id: string;
  login: string;
  role: Role;
};
