import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContentGraphService,
  type GraphUpdateEdge,
  type GraphUpdateNode,
} from './content-graph.service';
import { ContentWriteService } from './content-write.service';
import { type CreateTaskDto, type UpdateTaskDto } from './dto/task.dto';
import { type CreateCourseDto, type UpdateCourseDto } from './dto/course.dto';
import { type CreateSectionDto, type UpdateSectionDto } from './dto/section.dto';
import { type CreateUnitDto, type UpdateUnitDto } from './dto/unit.dto';
import {
  TaskRevisionPayloadService,
  type TaskWithActiveRevision,
} from './task-revision-payload.service';

@Injectable()
export class ContentService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ContentGraphService)
    private readonly contentGraphService: ContentGraphService,
    @Inject(ContentWriteService)
    private readonly contentWriteService: ContentWriteService,
    @Inject(TaskRevisionPayloadService)
    private readonly taskRevisionPayloadService: TaskRevisionPayloadService,
  ) {}

  async listCourses() {
    return this.prisma.course.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async listPublishedCourses() {
    return this.prisma.course.findMany({
      where: { status: ContentStatus.published },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getCourse(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async getPublishedCourse(id: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, status: ContentStatus.published },
      include: {
        sections: {
          where: { status: ContentStatus.published },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async createCourse(dto: CreateCourseDto) {
    return this.contentWriteService.createCourse(dto);
  }

  async updateCourse(id: string, dto: UpdateCourseDto) {
    return this.contentWriteService.updateCourse(id, dto);
  }

  async publishCourse(id: string) {
    return this.contentWriteService.publishCourse(id);
  }

  async unpublishCourse(id: string) {
    return this.contentWriteService.unpublishCourse(id);
  }

  async deleteCourse(id: string) {
    return this.contentWriteService.deleteCourse(id);
  }

  async getSection(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: { units: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async getSectionMeta(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      select: {
        id: true,
        courseId: true,
        title: true,
        status: true,
      },
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async getPublishedSection(id: string) {
    const section = await this.prisma.section.findFirst({
      where: {
        id,
        status: ContentStatus.published,
        course: { status: ContentStatus.published },
      },
      include: {
        units: {
          where: { status: ContentStatus.published },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async getSectionGraph(sectionId: string) {
    return this.contentGraphService.getSectionGraph(sectionId);
  }

  async getPublishedSectionGraph(sectionId: string) {
    return this.contentGraphService.getPublishedSectionGraph(sectionId);
  }

  async updateSectionGraph(
    sectionId: string,
    nodes: GraphUpdateNode[],
    edges: GraphUpdateEdge[],
  ) {
    return this.contentGraphService.updateSectionGraph(sectionId, nodes, edges);
  }

  async createSection(dto: CreateSectionDto) {
    return this.contentWriteService.createSection(dto);
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    return this.contentWriteService.updateSection(id, dto);
  }

  async publishSection(id: string) {
    return this.contentWriteService.publishSection(id);
  }

  async unpublishSection(id: string) {
    return this.contentWriteService.unpublishSection(id);
  }

  async deleteSection(id: string) {
    return this.contentWriteService.deleteSection(id);
  }

  async getUnit(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        section: {
          select: {
            id: true,
            title: true,
            courseId: true,
          },
        },
        tasks: {
          orderBy: { sortOrder: 'asc' },
          include: {
            activeRevision: {
              include: {
                numericParts: true,
                choices: true,
                correctChoices: true,
              },
            },
          },
        },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return {
      ...unit,
      tasks: unit.tasks.map((task) =>
        this.taskRevisionPayloadService.mapTaskWithRevision(task as TaskWithActiveRevision),
      ),
    };
  }

  async getPublishedUnit(id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: {
        id,
        status: ContentStatus.published,
        section: {
          status: ContentStatus.published,
          course: { status: ContentStatus.published },
        },
      },
      include: {
        tasks: {
          where: { status: ContentStatus.published },
          orderBy: { sortOrder: 'asc' },
          include: {
            activeRevision: {
              include: {
                numericParts: true,
                choices: true,
                correctChoices: true,
              },
            },
          },
        },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return {
      ...unit,
      tasks: unit.tasks.map((task) =>
        this.taskRevisionPayloadService.mapTaskWithRevision(task as TaskWithActiveRevision),
      ),
    };
  }

  async createUnit(dto: CreateUnitDto) {
    return this.contentWriteService.createUnit(dto);
  }

  async updateUnit(id: string, dto: UpdateUnitDto) {
    return this.contentWriteService.updateUnit(id, dto);
  }

  async publishUnit(id: string) {
    return this.contentWriteService.publishUnit(id);
  }

  async getUnitPdfAssetKey(id: string, target: 'theory' | 'method') {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      select: {
        id: true,
        theoryPdfAssetKey: true,
        methodPdfAssetKey: true,
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return target === 'theory' ? unit.theoryPdfAssetKey : unit.methodPdfAssetKey;
  }

  async getTaskForSolutionPdfCompile(taskId: string): Promise<{ id: string; activeRevisionId: string }> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        activeRevisionId: true,
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (!task.activeRevisionId) {
      throw new ConflictException({
        code: 'TASK_ACTIVE_REVISION_MISSING',
        message: 'Task active revision is missing',
      });
    }

    return {
      id: task.id,
      activeRevisionId: task.activeRevisionId,
    };
  }

  async updateTaskRevisionSolutionRichLatex(taskRevisionId: string, latex: string) {
    return this.contentWriteService.updateTaskRevisionSolutionRichLatex(taskRevisionId, latex);
  }

  async getTaskSolutionPdfState(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        activeRevisionId: true,
        activeRevision: {
          select: {
            id: true,
            solutionPdfAssetKey: true,
          },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (!task.activeRevisionId || !task.activeRevision) {
      throw new ConflictException({
        code: 'TASK_ACTIVE_REVISION_MISSING',
        message: 'Task active revision is missing',
      });
    }

    return {
      taskId: task.id,
      activeRevisionId: task.activeRevisionId,
      solutionPdfAssetKey: task.activeRevision.solutionPdfAssetKey,
    };
  }

  async getTaskStatementImageState(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        activeRevisionId: true,
        activeRevision: {
          select: {
            id: true,
            statementImageAssetKey: true,
          },
        },
      },
    });
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found',
      });
    }
    if (!task.activeRevisionId || !task.activeRevision) {
      throw new ConflictException({
        code: 'TASK_ACTIVE_REVISION_MISSING',
        message: 'Task active revision is missing',
      });
    }

    return {
      taskId: task.id,
      activeRevisionId: task.activeRevisionId,
      statementImageAssetKey: task.activeRevision.statementImageAssetKey,
    };
  }

  async setTaskRevisionSolutionPdfAssetKey(taskRevisionId: string, key: string) {
    return this.contentWriteService.setTaskRevisionSolutionPdfAssetKey(taskRevisionId, key);
  }

  async setTaskRevisionStatementImageAssetKey(taskRevisionId: string, key: string | null) {
    return this.contentWriteService.setTaskRevisionStatementImageAssetKey(taskRevisionId, key);
  }

  async unpublishUnit(id: string) {
    return this.contentWriteService.unpublishUnit(id);
  }

  async deleteUnit(id: string) {
    return this.contentWriteService.deleteUnit(id);
  }

  async getTask(id: string) {
    const task = await this.prisma.task.findUnique({
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
    if (!task) throw new NotFoundException('Task not found');
    return this.taskRevisionPayloadService.mapTaskWithRevision(task as TaskWithActiveRevision);
  }

  async createTask(dto: CreateTaskDto) {
    return this.contentWriteService.createTask(dto);
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    return this.contentWriteService.updateTask(id, dto);
  }

  async publishTask(id: string) {
    return this.contentWriteService.publishTask(id);
  }

  async unpublishTask(id: string) {
    return this.contentWriteService.unpublishTask(id);
  }

  async deleteTask(id: string) {
    return this.contentWriteService.deleteTask(id);
  }

  mapTaskWithRevision(task: TaskWithActiveRevision) {
    return this.taskRevisionPayloadService.mapTaskWithRevision(task);
  }

}
