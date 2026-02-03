import { Role } from '@prisma/client';

export type PublicUser = {
  id: string;
  login: string;
  role: Role;
};

export type CreateUserInput = {
  login: string;
  passwordHash: string;
  role: Role;
};
