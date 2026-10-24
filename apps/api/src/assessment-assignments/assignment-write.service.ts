import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { AssignmentCreatedSchema, type AssignmentCreate } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';
import { isTransactionWriteConflict, retryTransaction } from '../prisma/transaction-retry';
import { AssessmentWorksReadService } from '../assessment-works/assessment-works-read.service';
import { AssessmentWorksWriteService } from '../assessment-works/assessment-works-write.service';
import { AssignmentRosterService } from './assignment-roster.service';
import { inputHash, json } from './assignment-data';

export const isAssignmentWriteConflict = isTransactionWriteConflict;

@Injectable()
export class AssignmentWriteService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AssessmentWorksReadService) private readonly works: AssessmentWorksReadService,
    @Inject(AssessmentWorksWriteService) private readonly writes: AssessmentWorksWriteService,
    @Inject(AssignmentRosterService) private readonly roster: AssignmentRosterService) {}

  async assign(teacherId: string, workId: string, input: AssignmentCreate) {
    try { return await retryTransaction(() => this.assignOnce(teacherId, workId, input)); }
    catch (error) {
      if (!isAssignmentWriteConflict(error)) throw error;
      throw new ConflictException('Работа изменяется одновременно с другим действием. Обновите список и повторите назначение.');
    }
  }
  private assignOnce(teacherId: string, workId: string, input: AssignmentCreate) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM assessment_works WHERE id = ${workId}::uuid AND teacher_id = ${teacherId}::uuid FOR UPDATE`;
      const current = await this.works.owned(teacherId, workId, tx);
      const previous = await tx.assessmentAssignmentRequest.findUnique({ where: { id: input.requestId } });
      const hash = inputHash(input);
      if (previous) {
        if (previous.workId !== workId || previous.inputHash !== hash) throw new ConflictException('Ключ назначения уже использован с другими данными.');
        if (previous.invalidatedAt) throw new ConflictException('Назначения этой работы изменились после отзыва. Проверьте получателей и назначьте работу заново.');
        return AssignmentCreatedSchema.parse(previous.result);
      }
      if (input.selection.kind === 'draft' && current.revision !== input.selection.expectedRevision) throw new ConflictException('Работа изменилась. Проверьте актуальную редакцию перед назначением.');
      const version = input.selection.kind === 'draft'
        ? await this.writes.freezeInTransaction(tx, teacherId, workId, input.selection.expectedRevision)
        : await this.works.version(teacherId, workId, input.selection.number);
      const choices = await this.roster.classes(teacherId, version.id, tx, input.classes.map((item) => item.id));
      let addedCount = 0;
      for (const selected of input.classes) {
        const schoolClass = choices.find((item) => item.id === selected.id);
        if (!schoolClass || schoolClass.rosterHash !== selected.rosterHash) throw new ConflictException('Состав или состояние класса изменились. Проверьте список получателей заново.');
        const students = schoolClass.students.filter((item) => item.isActive && !item.alreadyAssigned);
        if (!students.length) {
          if (!schoolClass.assignmentId && !schoolClass.students.some((item) => item.alreadyAssigned)) throw new BadRequestException('В выбранном классе нет активных учеников.');
          continue;
        }
        const assignment = await tx.assessmentAssignment.upsert({ where: { versionId_classId: { versionId: version.id, classId: schoolClass.id } }, update: {},
          create: { versionId: version.id, classId: schoolClass.id, classTitle: schoolClass.title, academicYear: schoolClass.academicYear } });
        const created = await tx.assessmentRecipient.createMany({ skipDuplicates: true, data: students.map((student) => ({ assignmentId: assignment.id, versionId: version.id, studentId: student.id, studentName: student.name, studentLogin: student.login })) });
        addedCount += created.count;
      }
      const result = { versionId: version.id, versionNumber: version.number, addedCount };
      await tx.assessmentAssignmentRequest.create({ data: { id: input.requestId, workId, inputHash: hash, result: json(result) } });
      return result;
    }, { isolationLevel: 'Serializable', timeout: 30000 });
  }
}
