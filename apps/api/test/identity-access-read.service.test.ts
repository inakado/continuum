import { describe, expect, it, vi } from 'vitest';
import { IdentityAccessReadService } from '../src/identity-access/identity-access-read.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const teacherId = '123e4567-e89b-12d3-a456-426614174001';

describe('IdentityAccessReadService', () => {
  it('lists only students led by the current teacher and maps their grants', async () => {
    const prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            login: 'student.one',
            name: 'Иван Иванов',
            isActive: true,
            studentProfile: { firstName: 'Иван', lastName: 'Иванов' },
            accessGrants: [{ gradeBand: 'grade_8' }],
          },
        ]),
      },
    };
    const service = new IdentityAccessReadService(prisma as unknown as PrismaService);

    await expect(service.getStudents(teacherId)).resolves.toEqual({
      students: [
        expect.objectContaining({
          login: 'student.one',
          isActive: true,
          gradeBands: ['grade_8'],
        }),
      ],
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentProfile: { is: { leadTeacherId: teacherId } },
        }),
      }),
    );
  });
});
