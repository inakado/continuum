import { Inject, Injectable } from '@nestjs/common';
import type {
  StudentPhotoPresignViewQuery,
  TeacherPhotoInboxQuery,
  TeacherPhotoPresignViewQuery,
  TeacherPhotoQueueQuery,
  TeacherPhotoSubmissionDetailQuery,
} from '@continuum/shared';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { LearningAvailabilityService } from './learning-availability.service';
import { PhotoTaskPolicyService } from './photo-task-policy.service';
import {
  getTeacherInboxSubmission,
  listTeacherPhotoInbox,
  listTeacherPhotoQueue,
  listTeacherPhotoSubmissionsForTask,
  presignTeacherPhotoView,
} from './photo-task-teacher-read';
import {
  listStudentPhotoSubmissions,
  presignStudentPhotoView,
} from './photo-task-student-read';

@Injectable()
export class PhotoTaskReadService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(StudentsService)
    private readonly studentsService: StudentsService,
    @Inject(LearningAvailabilityService)
    private readonly learningAvailabilityService: LearningAvailabilityService,
    @Inject(ObjectStorageService)
    private readonly objectStorageService: ObjectStorageService,
    @Inject(PhotoTaskPolicyService)
    private readonly photoTaskPolicyService: PhotoTaskPolicyService,
  ) {}

  async listForTeacher(teacherId: string, studentId: string, taskId: string) {
    return listTeacherPhotoSubmissionsForTask({
      prisma: this.prisma,
      studentId,
      studentsService: this.studentsService,
      taskId,
      teacherId,
    });
  }

  async listForStudent(studentId: string, taskId: string) {
    return listStudentPhotoSubmissions({
      learningAvailabilityService: this.learningAvailabilityService,
      prisma: this.prisma,
      studentId,
      taskId,
    });
  }

  async listQueueForTeacher(
    teacherId: string,
    studentId: string,
    query: TeacherPhotoQueueQuery,
  ) {
    return listTeacherPhotoQueue({
      prisma: this.prisma,
      query,
      studentId,
      studentsService: this.studentsService,
      teacherId,
    });
  }

  async listInboxForTeacher(teacherId: string, query: TeacherPhotoInboxQuery) {
    return listTeacherPhotoInbox({
      prisma: this.prisma,
      query,
      teacherId,
    });
  }

  async getInboxSubmissionForTeacher(
    teacherId: string,
    submissionId: string,
    query: TeacherPhotoSubmissionDetailQuery,
  ) {
    return getTeacherInboxSubmission({
      prisma: this.prisma,
      query,
      submissionId,
      teacherId,
    });
  }

  async presignViewForStudent(
    studentId: string,
    taskId: string,
    query: StudentPhotoPresignViewQuery,
  ) {
    return presignStudentPhotoView({
      learningAvailabilityService: this.learningAvailabilityService,
      objectStorageService: this.objectStorageService,
      photoTaskPolicyService: this.photoTaskPolicyService,
      prisma: this.prisma,
      query,
      studentId,
      taskId,
    });
  }

  async presignViewForTeacher(
    teacherId: string,
    studentId: string,
    taskId: string,
    query: TeacherPhotoPresignViewQuery,
  ) {
    return presignTeacherPhotoView({
      objectStorageService: this.objectStorageService,
      photoTaskPolicyService: this.photoTaskPolicyService,
      prisma: this.prisma,
      query,
      studentId,
      studentsService: this.studentsService,
      taskId,
      teacherId,
    });
  }
}
