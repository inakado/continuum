import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContentStatus, TaskAnswerType } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type {
  TaskRevisionPayloadService,
  TaskRevisionRecord,
  TaskWithActiveRevision,
} from './task-revision-payload.service';
import type { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

export class ContentWriteTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskRevisionPayloadService: TaskRevisionPayloadService,
  ) {}

  updateTaskRevisionSolutionRichLatex(taskRevisionId: string, latex: string) {
    return this.prisma.taskRevision.update({
      where: { id: taskRevisionId },
      data: {
        solutionRichLatex: latex,
      },
      select: {
        id: true,
        taskId: true,
      },
    });
  }

  setTaskRevisionSolutionPdfAssetKey(taskRevisionId: string, key: string) {
    return this.prisma.taskRevision.update({
      where: { id: taskRevisionId },
      data: {
        solutionPdfAssetKey: key,
      },
      select: {
        id: true,
        taskId: true,
        solutionPdfAssetKey: true,
      },
    });
  }

  setTaskRevisionSolutionRenderedAssets(
    taskRevisionId: string,
    htmlAssetKey: string,
    htmlAssets: Array<{
      placeholder: string;
      assetKey: string;
      contentType: 'image/svg+xml';
    }>,
  ) {
    return this.prisma.taskRevision.update({
      where: { id: taskRevisionId },
      data: {
        solutionHtmlAssetKey: htmlAssetKey,
        solutionHtmlAssetsJson: htmlAssets,
      },
      select: {
        id: true,
        taskId: true,
        solutionHtmlAssetKey: true,
        solutionHtmlAssetsJson: true,
      },
    });
  }

  setTaskRevisionStatementImageAssetKey(taskRevisionId: string, key: string | null) {
    return this.prisma.taskRevision.update({
      where: { id: taskRevisionId },
      data: {
        statementImageAssetKey: key,
      },
      select: {
        id: true,
        taskId: true,
        statementImageAssetKey: true,
      },
    });
  }

  async createTask(dto: CreateTaskDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    const normalized = this.taskRevisionPayloadService.normalizeTaskPayload({
      answerType: dto.answerType,
      statementLite: dto.statementLite,
      methodGuidance: dto.methodGuidance ?? null,
      numericPartsJson: dto.numericPartsJson,
      choicesJson: dto.choicesJson,
      correctAnswerJson: dto.correctAnswerJson,
      statementImageAssetKey: null,
      solutionLite: dto.solutionLite ?? null,
      solutionRichLatex: null,
      solutionPdfAssetKey: null,
      solutionHtmlAssetKey: null,
      solutionHtmlAssetsJson: null,
    });

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          unitId: dto.unitId,
          title: null,
          isRequired: dto.isRequired ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });

      const revision = await this.taskRevisionPayloadService.createTaskRevision(
        tx,
        task.id,
        1,
        normalized,
      );
      const updatedTask = await tx.task.update({
        where: { id: task.id },
        data: { activeRevisionId: revision.id },
      });
      if (!updatedTask.activeRevisionId) {
        throw new ConflictException({
          code: 'TASK_ACTIVE_REVISION_MISSING',
          message: 'Task active revision is missing',
        });
      }

      return this.mapTaskResponse(
        updatedTask,
        {
          ...revision,
          solutionHtmlAssetsJson: normalized.solutionHtmlAssetsJson,
        },
        normalized,
      );
    });
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    const current = await this.prisma.task.findUnique({
      where: { id },
      include: {
        activeRevision: {
          include: {
            numericParts: true,
            choices: true,
            correctChoices: true,
          },
        },
      },
    });
    if (!current) throw new NotFoundException('Task not found');
    const currentView = this.taskRevisionPayloadService.mapTaskWithRevision(
      current as TaskWithActiveRevision,
    );

    const merged = {
      title: null,
      statementLite: dto.statementLite ?? currentView.statementLite,
      methodGuidance:
        dto.methodGuidance !== undefined ? dto.methodGuidance : currentView.methodGuidance ?? null,
      answerType: (dto.answerType ?? currentView.answerType) as TaskAnswerType,
      numericPartsJson:
        dto.numericPartsJson !== undefined ? dto.numericPartsJson : currentView.numericPartsJson,
      choicesJson: dto.choicesJson !== undefined ? dto.choicesJson : currentView.choicesJson,
      correctAnswerJson:
        dto.correctAnswerJson !== undefined
          ? dto.correctAnswerJson
          : currentView.correctAnswerJson,
      statementImageAssetKey: currentView.statementImageAssetKey ?? null,
      solutionLite: dto.solutionLite !== undefined ? dto.solutionLite : currentView.solutionLite,
      solutionRichLatex: currentView.solutionRichLatex ?? null,
      solutionPdfAssetKey: currentView.solutionPdfAssetKey ?? null,
      solutionHtmlAssetKey: currentView.solutionHtmlAssetKey ?? null,
      solutionHtmlAssetsJson: currentView.solutionHtmlAssetsJson ?? null,
      isRequired: dto.isRequired ?? currentView.isRequired,
      sortOrder: dto.sortOrder ?? currentView.sortOrder,
    };

    const normalized = this.taskRevisionPayloadService.normalizeTaskPayload({
      answerType: merged.answerType,
      statementLite: merged.statementLite,
      methodGuidance: merged.methodGuidance,
      numericPartsJson: merged.numericPartsJson,
      choicesJson: merged.choicesJson,
      correctAnswerJson: merged.correctAnswerJson,
      statementImageAssetKey: merged.statementImageAssetKey,
      solutionLite: merged.solutionLite ?? null,
      solutionRichLatex: merged.solutionRichLatex,
      solutionPdfAssetKey: merged.solutionPdfAssetKey,
      solutionHtmlAssetKey: merged.solutionHtmlAssetKey,
      solutionHtmlAssetsJson: merged.solutionHtmlAssetsJson,
    });

    return this.prisma.$transaction(async (tx) => {
      const revisionNo = await this.taskRevisionPayloadService.nextTaskRevisionNo(tx, id);
      const revision = await this.taskRevisionPayloadService.createTaskRevision(
        tx,
        id,
        revisionNo,
        normalized,
      );
      const updatedTask = await tx.task.update({
        where: { id },
        data: {
          title: null,
          isRequired: merged.isRequired,
          sortOrder: merged.sortOrder,
          activeRevisionId: revision.id,
        },
      });
      if (!updatedTask.activeRevisionId) {
        throw new ConflictException({
          code: 'TASK_ACTIVE_REVISION_MISSING',
          message: 'Task active revision is missing',
        });
      }

      return this.mapTaskResponse(
        updatedTask,
        {
          ...revision,
          solutionHtmlAssetsJson: normalized.solutionHtmlAssetsJson,
        },
        normalized,
      );
    });
  }

  async publishTask(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { unit: true },
    });
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found',
      });
    }

    if (task.unit.status !== ContentStatus.published) {
      throw new ConflictException({
        code: 'TASK_PARENT_UNIT_DRAFT',
        message: 'Cannot publish Task: parent Unit is draft',
      });
    }

    return this.prisma.task.update({
      where: { id },
      data: { status: ContentStatus.published },
    });
  }

  async unpublishTask(id: string) {
    const exists = await this.prisma.task.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found',
      });
    }

    return this.prisma.task.update({
      where: { id },
      data: { status: ContentStatus.draft },
    });
  }

  async deleteTask(id: string) {
    const exists = await this.prisma.task.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Task not found');

    return this.prisma.task.delete({ where: { id } });
  }

  private mapTaskResponse(
    task: {
      id: string;
      unitId: string;
      title: string | null;
      isRequired: boolean;
      status: string;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    },
    revision: {
      id: string;
      answerType: TaskAnswerType;
      statementLite: string;
      methodGuidance: string | null;
      statementImageAssetKey: string | null;
      solutionLite: string | null;
      solutionRichLatex: string | null;
      solutionPdfAssetKey: string | null;
      solutionHtmlAssetKey: string | null;
      solutionHtmlAssetsJson: Array<{
        placeholder: string;
        assetKey: string;
        contentType: 'image/svg+xml';
      }> | null;
    },
    normalized: ReturnType<TaskRevisionPayloadService['normalizeTaskPayload']>,
  ) {
    const revisionSnapshot = this.createRevisionSnapshot(revision, normalized);

    return this.taskRevisionPayloadService.mapTaskWithRevision({
      id: task.id,
      unitId: task.unitId,
      title: task.title,
      isRequired: task.isRequired,
      status: task.status,
      sortOrder: task.sortOrder,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      activeRevision: revisionSnapshot,
    } as TaskWithActiveRevision);
  }

  private createRevisionSnapshot(
    revision: {
      id: string;
      answerType: TaskAnswerType;
      statementLite: string;
      methodGuidance: string | null;
      statementImageAssetKey: string | null;
      solutionLite: string | null;
      solutionRichLatex: string | null;
      solutionPdfAssetKey: string | null;
      solutionHtmlAssetKey: string | null;
      solutionHtmlAssetsJson: Array<{
        placeholder: string;
        assetKey: string;
        contentType: 'image/svg+xml';
      }> | null;
    },
    normalized: ReturnType<TaskRevisionPayloadService['normalizeTaskPayload']>,
  ): TaskRevisionRecord {
    const correctKeys =
      normalized.answerType === TaskAnswerType.single_choice
        ? normalized.correctAnswerJson?.key
          ? [normalized.correctAnswerJson.key]
          : []
        : normalized.correctAnswerJson?.keys ?? [];

    return {
      id: revision.id,
      answerType: revision.answerType,
      statementLite: revision.statementLite,
      methodGuidance: revision.methodGuidance,
      statementImageAssetKey: revision.statementImageAssetKey,
      solutionLite: revision.solutionLite,
      solutionRichLatex: revision.solutionRichLatex,
      solutionPdfAssetKey: revision.solutionPdfAssetKey,
      solutionHtmlAssetKey: revision.solutionHtmlAssetKey,
      solutionHtmlAssetsJson: revision.solutionHtmlAssetsJson,
      numericParts:
        normalized.numericPartsJson?.map((part) => ({
          partKey: part.key,
          labelLite: part.labelLite ?? null,
          correctValue: part.correctValue,
        })) ?? [],
      choices:
        normalized.choicesJson?.map((choice) => ({
          choiceKey: choice.key,
          contentLite: choice.textLite,
        })) ?? [],
      correctChoices: correctKeys.map((key) => ({ choiceKey: key })),
    };
  }
}
