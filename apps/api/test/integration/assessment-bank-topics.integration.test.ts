import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { AssessmentBankQuerySchema } from '@continuum/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { AssessmentBankReadService } from '../../src/assessment-bank/assessment-bank-read.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { parseAssessmentArchive } from '../../src/assessment-bank/assessment-archive';

const prisma = new PrismaService();
const teacherIds: string[] = [];
const paths = [['Механика'], ['Механика', 'Кинематика'], ['Механика', 'Кинематика', 'Графики', 'Скорость', 'Ускорение'], ['Оптика', 'Кинематика'], ['Кинематика', 'Механика']];
const service = new AssessmentBankReadService(prisma, {} as ObjectStorageService);
beforeAll(async () => {
  await prisma.$connect();
  for (let owner = 0; owner < 2; owner++) {
    const result = await new IdentityProvisioningService(prisma).createTeacher({ login: `topics-${randomUUID()}`, password: 'Topics-test-12345', firstName: 'Тест', lastName: 'Темы', middleName: null });
    teacherIds.push(result.user.id);
    for (const [index, topicPath] of paths.entries()) {
      const taskId = randomUUID(), id = `topics-${index}`;
      const task = { id, title: id, type: 'short_number', gradeBand: 'grade_10_11', topicPath, maxPoints: 1, source: { provider: 'Проверка тем', exam: 'none' }, grading: { answer: '1', absoluteTolerance: 0 } };
      await prisma.assessmentBankTask.create({ data: { id: taskId, teacherId: result.user.id, stableId: id } });
      const version = await prisma.assessmentTaskVersion.create({ data: { taskId, version: 1, title: id, gradeBand: 'grade_10_11', type: 'short_number', topicPath, contentHash: 'topics', searchText: id, data: { task, statement: 'Проверка темы.', solution: null, images: [], hash: 'topics' } as Prisma.InputJsonValue } });
      await prisma.assessmentBankTask.update({ where: { id: taskId }, data: { latestVersionId: version.id } });
    }
  }
}, 30000);
afterAll(async () => {
  await prisma.assessmentBankTask.deleteMany({ where: { teacherId: { in: teacherIds } } });
  await prisma.user.deleteMany({ where: { id: { in: teacherIds } } });
  await prisma.$disconnect();
});
it('matches a path prefix, including its own tasks, with the same semantics in export', async () => {
  const query = AssessmentBankQuerySchema.parse({ topicPath: JSON.stringify(['Механика']), source: 'Проверка тем', exam: 'none' });
  const list = await service.list(teacherIds[0], query);
  expect(list.total).toBe(3);
  expect(list.tasks.map((task) => task.stableId)).toEqual(['topics-0', 'topics-1', 'topics-2']);
  expect(list.topicPaths).toEqual(expect.arrayContaining(paths));
  const exported = await parseAssessmentArchive(await service.export(teacherIds[0], query));
  expect(exported.tasks.map((entry) => entry.task.id)).toEqual(['topics-0', 'topics-1', 'topics-2']);
  expect((await service.list(teacherIds[0], { ...query, topicPath: ['Механика', 'Кинематика'] })).total).toBe(2);
  expect((await service.list(teacherIds[0], { ...query, topicPath: paths[2] })).total).toBe(1);
  expect((await service.list(teacherIds[0], { ...query, topicPath: ['Механика', 'Нет темы'] })).total).toBe(0);
  expect((await service.list(teacherIds[0], { ...query, gradeBand: 'grade_8' })).total).toBe(0);
});
