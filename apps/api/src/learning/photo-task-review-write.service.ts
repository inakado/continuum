import { Inject, Injectable } from '@nestjs/common';
import type {
  StudentPhotoBoardPresignUploadRequest,
  StudentPhotoBoardSubmitRequest,
  StudentPhotoPresignUploadRequest,
  StudentPhotoSubmitRequest,
  TeacherPhotoAcceptRequest,
  TeacherPhotoFeedbackBoardPresignUploadRequest,
  TeacherPhotoRejectRequest,
} from '@continuum/shared';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { LearningAuditLogService } from './learning-audit-log.service';
import { LearningAvailabilityService } from './learning-availability.service';
import { PhotoTaskPolicyService } from './photo-task-policy.service';
import {
  presignStudentPhotoBoardUpload,
  presignStudentPhotoUpload,
  submitStudentPhotoBoardTask,
  submitStudentPhotoTask,
} from './photo-task-student-write';
import {
  acceptTeacherPhotoSubmission,
  presignTeacherFeedbackBoardUpload,
  rejectTeacherPhotoSubmission,
} from './photo-task-teacher-review-write';

@Injectable()
export class PhotoTaskReviewWriteService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(StudentsService)
    private readonly studentsService: StudentsService,
    @Inject(LearningAvailabilityService)
    private readonly learningAvailabilityService: LearningAvailabilityService,
    @Inject(LearningAuditLogService)
    private readonly learningAuditLogService: LearningAuditLogService,
    @Inject(ObjectStorageService)
    private readonly objectStorageService: ObjectStorageService,
    @Inject(PhotoTaskPolicyService)
    private readonly photoTaskPolicyService: PhotoTaskPolicyService,
  ) {}

  async presignUpload(studentId: string, taskId: string, body: StudentPhotoPresignUploadRequest) {
    return presignStudentPhotoUpload({
      body,
      learningAvailabilityService: this.learningAvailabilityService,
      objectStorageService: this.objectStorageService,
      photoTaskPolicyService: this.photoTaskPolicyService,
      prisma: this.prisma,
      studentId,
      taskId,
    });
  }

  async submit(studentId: string, taskId: string, body: StudentPhotoSubmitRequest) {
    return submitStudentPhotoTask({
      body,
      learningAuditLogService: this.learningAuditLogService,
      learningAvailabilityService: this.learningAvailabilityService,
      photoTaskPolicyService: this.photoTaskPolicyService,
      prisma: this.prisma,
      studentId,
      taskId,
    });
  }

  async presignBoardUpload(studentId: string, taskId: string, body: StudentPhotoBoardPresignUploadRequest) {
    return presignStudentPhotoBoardUpload({
      body,
      learningAvailabilityService: this.learningAvailabilityService,
      objectStorageService: this.objectStorageService,
      photoTaskPolicyService: this.photoTaskPolicyService,
      prisma: this.prisma,
      studentId,
      taskId,
    });
  }

  async submitBoard(studentId: string, taskId: string, body: StudentPhotoBoardSubmitRequest) {
    return submitStudentPhotoBoardTask({
      body,
      learningAuditLogService: this.learningAuditLogService,
      learningAvailabilityService: this.learningAvailabilityService,
      photoTaskPolicyService: this.photoTaskPolicyService,
      prisma: this.prisma,
      studentId,
      taskId,
    });
  }

  async presignFeedbackBoardUpload(
    teacherId: string,
    studentId: string,
    taskId: string,
    submissionId: string,
    body: TeacherPhotoFeedbackBoardPresignUploadRequest,
  ) {
    return presignTeacherFeedbackBoardUpload({
      body,
      objectStorageService: this.objectStorageService,
      photoTaskPolicyService: this.photoTaskPolicyService,
      prisma: this.prisma,
      studentId,
      studentsService: this.studentsService,
      submissionId,
      taskId,
      teacherId,
    });
  }

  async accept(
    teacherId: string,
    studentId: string,
    taskId: string,
    submissionId: string,
    body: TeacherPhotoAcceptRequest,
  ) {
    return acceptTeacherPhotoSubmission({
      body,
      learningAuditLogService: this.learningAuditLogService,
      learningAvailabilityService: this.learningAvailabilityService,
      photoTaskPolicyService: this.photoTaskPolicyService,
      prisma: this.prisma,
      studentId,
      studentsService: this.studentsService,
      submissionId,
      taskId,
      teacherId,
    });
  }

  async reject(
    teacherId: string,
    studentId: string,
    taskId: string,
    submissionId: string,
    body: TeacherPhotoRejectRequest,
  ) {
    return rejectTeacherPhotoSubmission({
      body,
      learningAuditLogService: this.learningAuditLogService,
      learningAvailabilityService: this.learningAvailabilityService,
      photoTaskPolicyService: this.photoTaskPolicyService,
      prisma: this.prisma,
      studentId,
      studentsService: this.studentsService,
      submissionId,
      taskId,
      teacherId,
    });
  }
}
