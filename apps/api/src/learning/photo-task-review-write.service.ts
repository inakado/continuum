import { Inject, Injectable } from '@nestjs/common';
import type {
  StudentPhotoPresignUploadRequest,
  StudentPhotoSubmitRequest,
  TeacherPhotoRejectRequest,
} from '@continuum/shared';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { LearningAuditLogService } from './learning-audit-log.service';
import { LearningAvailabilityService } from './learning-availability.service';
import { PhotoTaskPolicyService } from './photo-task-policy.service';
import { presignStudentPhotoUpload, submitStudentPhotoTask } from './photo-task-student-write';
import { acceptTeacherPhotoSubmission, rejectTeacherPhotoSubmission } from './photo-task-teacher-review-write';

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

  async accept(teacherId: string, studentId: string, taskId: string, submissionId: string) {
    return acceptTeacherPhotoSubmission({
      learningAuditLogService: this.learningAuditLogService,
      learningAvailabilityService: this.learningAvailabilityService,
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
      prisma: this.prisma,
      studentId,
      studentsService: this.studentsService,
      submissionId,
      taskId,
      teacherId,
    });
  }
}
