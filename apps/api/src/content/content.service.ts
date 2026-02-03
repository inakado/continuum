import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
      },
    });
  }

  async updateCourse(id: string, dto: UpdateCourseDto) {
    const exists = await this.prisma.course.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Course not found');

    const data: { title?: string; description?: string | null } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;

    return this.prisma.course.update({ where: { id }, data });
  }

  async publishCourse(id: string) {
    const exists = await this.prisma.course.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Course not found');

    return this.prisma.course.update({
      where: { id },
      data: { status: ContentStatus.published },
    });
  }

  async unpublishCourse(id: string) {
    const exists = await this.prisma.course.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Course not found');

    return this.prisma.course.update({
      where: { id },
      data: { status: ContentStatus.draft },
    });
  }

  async deleteCourse(id: string) {
    const exists = await this.prisma.course.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Course not found');

    const sectionsCount = await this.prisma.section.count({ where: { courseId: id } });
    if (sectionsCount > 0) {
      throw new ConflictException('Cannot delete Course: sections exist');
    }

    return this.prisma.course.delete({ where: { id } });
  }

  async getSection(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: { units: { orderBy: { sortOrder: 'asc' } } },
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

  async createSection(dto: CreateSectionDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Course not found');

    return this.prisma.section.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    const exists = await this.prisma.section.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Section not found');

    const data: { title?: string; sortOrder?: number } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return this.prisma.section.update({ where: { id }, data });
  }

  async publishSection(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: { course: true },
    });
    if (!section) throw new NotFoundException('Section not found');

    if (section.course.status !== ContentStatus.published) {
      throw new ConflictException('Cannot publish Section: parent Course is draft');
    }

    return this.prisma.section.update({
      where: { id },
      data: { status: ContentStatus.published },
    });
  }

  async unpublishSection(id: string) {
    const exists = await this.prisma.section.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Section not found');

    return this.prisma.section.update({
      where: { id },
      data: { status: ContentStatus.draft },
    });
  }

  async deleteSection(id: string) {
    const exists = await this.prisma.section.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Section not found');

    const unitsCount = await this.prisma.unit.count({ where: { sectionId: id } });
    if (unitsCount > 0) {
      throw new ConflictException('Cannot delete Section: units exist');
    }

    return this.prisma.section.delete({ where: { id } });
  }

  async getUnit(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
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
        },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async createUnit(dto: CreateUnitDto) {
    const section = await this.prisma.section.findUnique({ where: { id: dto.sectionId } });
    if (!section) throw new NotFoundException('Section not found');

    return this.prisma.unit.create({
      data: {
        sectionId: dto.sectionId,
        title: dto.title,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateUnit(id: string, dto: UpdateUnitDto) {
    const exists = await this.prisma.unit.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Unit not found');

    const data: { title?: string; sortOrder?: number } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return this.prisma.unit.update({ where: { id }, data });
  }

  async publishUnit(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { section: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    if (unit.section.status !== ContentStatus.published) {
      throw new ConflictException('Cannot publish Unit: parent Section is draft');
    }

    return this.prisma.unit.update({
      where: { id },
      data: { status: ContentStatus.published },
    });
  }

  async unpublishUnit(id: string) {
    const exists = await this.prisma.unit.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Unit not found');

    return this.prisma.unit.update({
      where: { id },
      data: { status: ContentStatus.draft },
    });
  }

  async deleteUnit(id: string) {
    const exists = await this.prisma.unit.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Unit not found');

    const tasksCount = await this.prisma.task.count({ where: { unitId: id } });
    if (tasksCount > 0) {
      throw new ConflictException('Cannot delete Unit: tasks exist');
    }

    return this.prisma.unit.delete({ where: { id } });
  }

  async getTask(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async createTask(dto: CreateTaskDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    return this.prisma.task.create({
      data: {
        unitId: dto.unitId,
        title: dto.title ?? null,
        statementLite: dto.statementLite,
        answerType: dto.answerType,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    const exists = await this.prisma.task.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Task not found');

    const data: {
      title?: string | null;
      statementLite?: string;
      answerType?: string;
      isRequired?: boolean;
      sortOrder?: number;
    } = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.statementLite !== undefined) data.statementLite = dto.statementLite;
    if (dto.answerType !== undefined) data.answerType = dto.answerType;
    if (dto.isRequired !== undefined) data.isRequired = dto.isRequired;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return this.prisma.task.update({ where: { id }, data });
  }

  async publishTask(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { unit: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    if (task.unit.status !== ContentStatus.published) {
      throw new ConflictException('Cannot publish Task: parent Unit is draft');
    }

    return this.prisma.task.update({
      where: { id },
      data: { status: ContentStatus.published },
    });
  }

  async unpublishTask(id: string) {
    const exists = await this.prisma.task.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Task not found');

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
}
