import { Inject, Injectable } from '@nestjs/common';
import type { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type PublicUser } from './users.types';

const authSelect = {
  id: true,
  login: true,
  role: true,
  passwordHash: true,
  isActive: true,
};

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByLogin(login: string) {
    return this.prisma.user.findUnique({
      where: { login },
      select: authSelect,
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: authSelect,
    });
  }

  toPublicUser(user: Pick<User, 'id' | 'login' | 'role'>): PublicUser {
    return { id: user.id, login: user.login, role: user.role };
  }

  isRole(role: Role): role is Role {
    return role === 'admin' || role === 'teacher' || role === 'student';
  }
}
