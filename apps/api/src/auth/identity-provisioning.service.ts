import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, Role } from '@prisma/client';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { buildIdentityName, buildTechnicalEmail, normalizeLogin } from './identity-policy';

type TeacherIdentityInput = {
  login: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
};

type StudentIdentityInput = {
  login: string;
  password: string;
  leadTeacherId: string;
  firstName: string | null;
  lastName: string | null;
};

@Injectable()
export class IdentityProvisioningService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  hashPassword(password: string) {
    return argon2.hash(password);
  }

  private buildUserData(input: {
    login: string;
    passwordHash: string;
    role: Role;
    firstName?: string | null;
    lastName?: string | null;
  }) {
    const login = normalizeLogin(input.login);
    return {
      login,
      displayLogin: login,
      email: buildTechnicalEmail(login),
      name: buildIdentityName({
        firstName: input.firstName,
        lastName: input.lastName,
        login,
      }),
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: true,
    };
  }

  private createCredentialAccount(
    tx: Prisma.TransactionClient,
    userId: string,
    passwordHash: string,
  ) {
    return tx.account.create({
      data: {
        accountId: userId,
        providerId: 'credential',
        userId,
        password: passwordHash,
      },
      select: { id: true },
    });
  }

  async createTeacher(input: TeacherIdentityInput) {
    const passwordHash = await this.hashPassword(input.password);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: this.buildUserData({
          ...input,
          passwordHash,
          role: Role.teacher,
        }),
        select: { id: true, login: true, role: true },
      });
      await this.createCredentialAccount(tx, user.id, passwordHash);
      const profile = await tx.teacherProfile.create({
        data: {
          userId: user.id,
          firstName: input.firstName,
          lastName: input.lastName,
          middleName: input.middleName,
        },
        select: {
          firstName: true,
          lastName: true,
          middleName: true,
        },
      });
      return { user, profile };
    });
  }

  async createStudent(input: StudentIdentityInput) {
    const passwordHash = await this.hashPassword(input.password);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: this.buildUserData({
          ...input,
          passwordHash,
          role: Role.student,
        }),
        select: { id: true, login: true, role: true },
      });
      await this.createCredentialAccount(tx, user.id, passwordHash);
      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          leadTeacherId: input.leadTeacherId,
          displayName: null,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });
      return { user, profile };
    });
  }

  async replacePasswordInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    passwordHash: string,
    revokeReason: 'PASSWORD_CHANGED' | 'PASSWORD_RESET',
  ) {
    const now = new Date();
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await tx.account.upsert({
      where: {
        providerId_accountId: {
          providerId: 'credential',
          accountId: userId,
        },
      },
      create: {
        accountId: userId,
        providerId: 'credential',
        userId,
        password: passwordHash,
      },
      update: { password: passwordHash },
    });
    await tx.session.deleteMany({ where: { userId } });
    await tx.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revokedAt: now,
        revokeReason,
        lastUsedAt: now,
      },
    });
    await tx.authRefreshToken.updateMany({
      where: {
        revokedAt: null,
        session: { userId },
      },
      data: { revokedAt: now },
    });
  }
}
