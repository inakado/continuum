import { Inject, Injectable } from '@nestjs/common';
import type {
  StudentPhotoPresignUploadRequest,
  StudentPhotoPresignViewQuery,
  StudentPhotoSubmitRequest,
  TeacherPhotoInboxQuery,
  TeacherPhotoPresignViewQuery,
  TeacherPhotoQueueQuery,
  TeacherPhotoRejectRequest,
  TeacherPhotoSubmissionDetailQuery,
} from '@continuum/shared';
import { PhotoTaskReadService } from './photo-task-read.service';
import { PhotoTaskReviewWriteService } from './photo-task-review-write.service';

@Injectable()
export class PhotoTaskService {
  constructor(
    @Inject(PhotoTaskReadService)
    private readonly photoTaskReadService: PhotoTaskReadService,
    @Inject(PhotoTaskReviewWriteService)
    private readonly photoTaskReviewWriteService: PhotoTaskReviewWriteService,
  ) {}

  async presignUpload(studentId: string, taskId: string, body: StudentPhotoPresignUploadRequest) {
    return this.photoTaskReviewWriteService.presignUpload(studentId, taskId, body);
  }

  async submit(studentId: string, taskId: string, body: StudentPhotoSubmitRequest) {
    return this.photoTaskReviewWriteService.submit(studentId, taskId, body);
  }

  async listForTeacher(teacherId: string, studentId: string, taskId: string) {
    return this.photoTaskReadService.listForTeacher(teacherId, studentId, taskId);
  }

  async listForStudent(studentId: string, taskId: string) {
    return this.photoTaskReadService.listForStudent(studentId, taskId);
  }

  async listQueueForTeacher(
    teacherId: string,
    studentId: string,
    query: TeacherPhotoQueueQuery,
  ) {
    return this.photoTaskReadService.listQueueForTeacher(teacherId, studentId, query);
  }

  async listInboxForTeacher(teacherId: string, query: TeacherPhotoInboxQuery) {
    return this.photoTaskReadService.listInboxForTeacher(teacherId, query);
  }

  async getInboxSubmissionForTeacher(
    teacherId: string,
    submissionId: string,
    query: TeacherPhotoSubmissionDetailQuery,
  ) {
    return this.photoTaskReadService.getInboxSubmissionForTeacher(teacherId, submissionId, query);
  }

  async presignViewForStudent(
    studentId: string,
    taskId: string,
    query: StudentPhotoPresignViewQuery,
  ) {
    return this.photoTaskReadService.presignViewForStudent(studentId, taskId, query);
  }

  async presignViewForTeacher(
    teacherId: string,
    studentId: string,
    taskId: string,
    query: TeacherPhotoPresignViewQuery,
  ) {
    return this.photoTaskReadService.presignViewForTeacher(teacherId, studentId, taskId, query);
  }

  async accept(teacherId: string, studentId: string, taskId: string, submissionId: string) {
    return this.photoTaskReviewWriteService.accept(teacherId, studentId, taskId, submissionId);
  }

  async reject(
    teacherId: string,
    studentId: string,
    taskId: string,
    submissionId: string,
    body: TeacherPhotoRejectRequest,
  ) {
    return this.photoTaskReviewWriteService.reject(teacherId, studentId, taskId, submissionId, body);
  }
}
