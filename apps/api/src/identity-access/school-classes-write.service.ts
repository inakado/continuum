import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, GoneException, Inject, Injectable } from '@nestjs/common';
import type { BulkCreateStudentsInput, BulkCreateStudentsResult, RosterStudent, SchoolClassInput, UpdateSchoolClassInput } from '@continuum/shared';
import { IdentityProvisioningService } from '../auth/identity-provisioning.service';
import { PrismaService } from '../prisma/prisma.service';
import { classTransaction, grantClassLibrary, hasDbCode, isLoginConflict, managedClass, managedStudent } from './school-class-policy';
import { reserveStudentLogin, studentLoginBase } from './student-login';

const requestUsed = () => new ConflictException({ code: 'REQUEST_ALREADY_USED', message: 'Этот запрос уже выполнен с другими данными. Начните новое добавление.' });
const randomPassword = () => randomBytes(12).toString('base64url');

@Injectable()
export class SchoolClassesWriteService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdentityProvisioningService) private readonly identities: IdentityProvisioningService,
  ) {}

  async createClass(teacherId: string, input: SchoolClassInput) {
    try {
      const item = await this.prisma.schoolClass.create({ data: { ...input, teacherId } });
      return { ...item, studentCount: 0 };
    } catch (error) { this.classConflict(error); }
  }

  async updateClass(_teacherId: string, id: string, input: UpdateSchoolClassInput) {
    try {
      return await classTransaction(this.prisma, async (tx) => {
        await managedClass(tx, id, false);
        const item = await tx.schoolClass.update({ where: { id }, data: input, include: { _count: { select: { students: { where: { deletedAt: null } } } } } });
        return { ...item, studentCount: item._count.students };
      });
    } catch (error) { this.classConflict(error); }
  }

  async setStudentClass(teacherId: string, id: string, classId: string | null) {
    return classTransaction(this.prisma, async (tx) => {
      await managedStudent(tx, id);
      if (classId) {
        const schoolClass = await managedClass(tx, classId);
        await grantClassLibrary(tx, id, teacherId, schoolClass.grade);
      }
      // Assignments, grants and identity are independent of the current class.
      await tx.studentProfile.update({ where: { userId: id }, data: { classId } });
      return { id, classId };
    });
  }

  async createStudents(teacherId: string, input: BulkCreateStudentsInput): Promise<BulkCreateStudentsResult> {
    const inputHash = createHash('sha256').update(JSON.stringify({ classId: input.classId ?? null, newClass: input.newClass ?? null, students: input.students })).digest('hex');
    const previous = await this.replayBatch(teacherId, input.requestId, inputHash);
    if (previous) return previous;
    // Hash outside the DB transaction, sequentially to bound Argon2 memory use.
    const prepared: Array<RosterStudent & { password: string; hash: string }> = [];
    for (const student of input.students) {
      const password = randomPassword();
      prepared.push({ ...student, password, hash: await this.identities.hashPassword(password) });
    }
    try {
      return await classTransaction(this.prisma, async (tx) => {
        const schoolClass = input.classId
          ? await managedClass(tx, input.classId)
          : await tx.schoolClass.create({ data: { ...input.newClass!, teacherId } });
        await tx.studentProvisioningBatch.create({ data: { id: input.requestId, teacherId, classId: schoolClass.id, inputHash } });
        const bases = [...new Set(prepared.map((student) => studentLoginBase(student.lastName)))];
        const existing = await tx.user.findMany({
          where: { OR: bases.map((base) => ({ login: { startsWith: base } })) },
          select: { login: true },
        });
        const used = new Set(existing.map((user) => user.login));
        const credentials = [];
        for (const student of prepared) {
          const { user } = await this.identities.createStudentInTransaction(tx, {
            login: reserveStudentLogin(student.lastName, used), leadTeacherId: teacherId, firstName: student.firstName,
            lastName: student.lastName, middleName: student.middleName || null,
            classId: schoolClass.id, provisioningBatchId: input.requestId,
          }, student.hash);
          await grantClassLibrary(tx, user.id, teacherId, schoolClass.grade);
          credentials.push({ id: user.id, name: [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' '), login: user.login, password: student.password });
        }
        return { classId: schoolClass.id, studentIds: credentials.map((item) => item.id), credentials, replayed: false };
      });
    } catch (error) {
      if (hasDbCode(error, 'P2002')) {
        const replay = await this.replayBatch(teacherId, input.requestId, inputHash);
        if (replay) return replay;
      }
      this.classConflict(error);
    }
  }

  private async replayBatch(teacherId: string, id: string, inputHash: string): Promise<BulkCreateStudentsResult | null> {
    const batch = await this.prisma.studentProvisioningBatch.findUnique({
      where: { id }, include: { students: { select: { userId: true } } },
    });
    if (!batch) return null;
    if (batch.teacherId !== teacherId || batch.inputHash !== inputHash) throw requestUsed();
    if (!batch.classId) throw new GoneException({ code: 'BATCH_CLASS_DELETED', message: 'Класс этого запроса уже удалён. Для нового создания начните добавление заново.' });
    return { classId: batch.classId, studentIds: batch.students.map((item) => item.userId), credentials: null, replayed: true };
  }

  async resetPassword(teacherId: string, studentId: string, requestId: string) {
    const replay = async () => {
      const previous = await this.prisma.studentPasswordReset.findUnique({ where: { id: requestId } });
      if (!previous) return null;
      if (previous.teacherId !== teacherId || previous.studentId !== studentId) throw requestUsed();
      return { credential: null, replayed: true };
    };
    const previous = await replay();
    if (previous) return previous;
    const password = randomPassword();
    const hash = await this.identities.hashPassword(password);
    try {
      return await classTransaction(this.prisma, async (tx) => {
        const student = await managedStudent(tx, studentId);
        await tx.studentPasswordReset.create({ data: { id: requestId, teacherId, studentId } });
        await this.identities.replacePasswordInTransaction(tx, studentId, hash);
        return { credential: { ...student, password }, replayed: false };
      });
    } catch (error) {
      if (hasDbCode(error, 'P2002')) {
        const result = await replay();
        if (result) return result;
      }
      throw error;
    }
  }

  private classConflict(error: unknown): never {
    if (isLoginConflict(error)) throw new ConflictException({ code: 'LOGIN_TAKEN', message: 'Логин был занят другим запросом. Повторите создание учеников.' });
    if (hasDbCode(error, 'P2002')) throw new ConflictException({ code: 'CLASS_TITLE_TAKEN', message: 'Класс с таким названием уже есть в этом учебном году.' });
    throw error;
  }

  async deleteClass(_teacherId: string, id: string, deleteStudents: boolean) {
    return classTransaction(this.prisma, async (tx) => {
      await managedClass(tx, id, false);
      let deletedStudentsCount = 0;
      if (deleteStudents) {
        const students = await tx.studentProfile.findMany({ where: { classId: id, deletedAt: null }, select: { userId: true } });
        const userIds = students.map((student) => student.userId);
        await tx.studentPasswordReset.deleteMany({ where: { studentId: { in: userIds } } });
        const result = await tx.user.deleteMany({ where: { id: { in: userIds }, role: 'student' } });
        deletedStudentsCount = result.count;
      }
      await tx.studentProfile.updateMany({ where: { classId: id }, data: { classId: null } });
      await tx.schoolClass.delete({ where: { id } });
      return { id, deletedStudentsCount };
    });
  }
}
