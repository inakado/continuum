import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import type { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';

export class ContentWriteCourseSectionService {
  constructor(private readonly prisma: PrismaService) {}

  createCourse(dto: CreateCourseDto) {
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

  async setCourseCoverImageAssetKey(id: string, key: string | null) {
    const exists = await this.prisma.course.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Course not found');

    return this.prisma.course.update({
      where: { id },
      data: { coverImageAssetKey: key },
    });
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

  async createSection(dto: CreateSectionDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Course not found');

    return this.prisma.section.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    const exists = await this.prisma.section.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Section not found');

    const data: { title?: string; description?: string | null; sortOrder?: number } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return this.prisma.section.update({ where: { id }, data });
  }

  async setSectionCoverImageAssetKey(id: string, key: string | null) {
    const exists = await this.prisma.section.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Section not found');

    return this.prisma.section.update({
      where: { id },
      data: { coverImageAssetKey: key },
    });
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
}
