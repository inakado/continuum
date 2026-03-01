import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import type { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';
import type { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import type { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';
import { ContentWriteCourseSectionService } from './content-write-course-section.service';
import { ContentWriteTaskService } from './content-write-task.service';
import { ContentWriteUnitService } from './content-write-unit.service';
import { TaskRevisionPayloadService } from './task-revision-payload.service';

@Injectable()
export class ContentWriteService {
  private readonly courseSectionWriteService: ContentWriteCourseSectionService;
  private readonly unitWriteService: ContentWriteUnitService;
  private readonly taskWriteService: ContentWriteTaskService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(TaskRevisionPayloadService) taskRevisionPayloadService: TaskRevisionPayloadService,
  ) {
    this.courseSectionWriteService = new ContentWriteCourseSectionService(prisma);
    this.unitWriteService = new ContentWriteUnitService(prisma);
    this.taskWriteService = new ContentWriteTaskService(prisma, taskRevisionPayloadService);
  }

  createCourse(dto: CreateCourseDto) {
    return this.courseSectionWriteService.createCourse(dto);
  }

  updateCourse(id: string, dto: UpdateCourseDto) {
    return this.courseSectionWriteService.updateCourse(id, dto);
  }

  publishCourse(id: string) {
    return this.courseSectionWriteService.publishCourse(id);
  }

  unpublishCourse(id: string) {
    return this.courseSectionWriteService.unpublishCourse(id);
  }

  deleteCourse(id: string) {
    return this.courseSectionWriteService.deleteCourse(id);
  }

  createSection(dto: CreateSectionDto) {
    return this.courseSectionWriteService.createSection(dto);
  }

  updateSection(id: string, dto: UpdateSectionDto) {
    return this.courseSectionWriteService.updateSection(id, dto);
  }

  publishSection(id: string) {
    return this.courseSectionWriteService.publishSection(id);
  }

  unpublishSection(id: string) {
    return this.courseSectionWriteService.unpublishSection(id);
  }

  deleteSection(id: string) {
    return this.courseSectionWriteService.deleteSection(id);
  }

  createUnit(dto: CreateUnitDto) {
    return this.unitWriteService.createUnit(dto);
  }

  updateUnit(id: string, dto: UpdateUnitDto) {
    return this.unitWriteService.updateUnit(id, dto);
  }

  publishUnit(id: string) {
    return this.unitWriteService.publishUnit(id);
  }

  unpublishUnit(id: string) {
    return this.unitWriteService.unpublishUnit(id);
  }

  deleteUnit(id: string) {
    return this.unitWriteService.deleteUnit(id);
  }

  updateTaskRevisionSolutionRichLatex(taskRevisionId: string, latex: string) {
    return this.taskWriteService.updateTaskRevisionSolutionRichLatex(taskRevisionId, latex);
  }

  setTaskRevisionSolutionPdfAssetKey(taskRevisionId: string, key: string) {
    return this.taskWriteService.setTaskRevisionSolutionPdfAssetKey(taskRevisionId, key);
  }

  setTaskRevisionStatementImageAssetKey(taskRevisionId: string, key: string | null) {
    return this.taskWriteService.setTaskRevisionStatementImageAssetKey(taskRevisionId, key);
  }

  createTask(dto: CreateTaskDto) {
    return this.taskWriteService.createTask(dto);
  }

  updateTask(id: string, dto: UpdateTaskDto) {
    return this.taskWriteService.updateTask(id, dto);
  }

  publishTask(id: string) {
    return this.taskWriteService.publishTask(id);
  }

  unpublishTask(id: string) {
    return this.taskWriteService.unpublishTask(id);
  }

  deleteTask(id: string) {
    return this.taskWriteService.deleteTask(id);
  }
}
