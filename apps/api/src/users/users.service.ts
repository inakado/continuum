import { ConflictException, Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserInput, PublicUser } from './users.types';

const authSelect = {
  id: true,
  login: true,
  role: true,
  passwordHash: true,
  isActive: true,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createUser(input: CreateUserInput): Promise<PublicUser> {
    try {
      const user = await this.prisma.user.create({
        data: {
          login: input.login,
          passwordHash: input.passwordHash,
          role: input.role,
          isActive: true,
        },
        select: {
          id: true,
          login: true,
          role: true,
        },
      });
      return user;
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2002') {
        throw new ConflictException('Login already exists');
      }
      throw error;
    }
  }

  toPublicUser(user: Pick<User, 'id' | 'login' | 'role'>): PublicUser {
    return { id: user.id, login: user.login, role: user.role };
  }

  isRole(role: Role): role is Role {
    return role === 'teacher' || role === 'student';
  }
}
