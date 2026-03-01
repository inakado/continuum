import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherAccountsService } from './teacher-accounts.service';
import { TeacherStudentsService } from './teacher-students.service';

@Injectable()
export class StudentsService {
  private readonly teacherAccountsService: TeacherAccountsService;
  private readonly teacherStudentsService: TeacherStudentsService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.teacherAccountsService = new TeacherAccountsService(prisma);
    this.teacherStudentsService = new TeacherStudentsService(prisma);
  }

  assertTeacherOwnsStudent(teacherId: string, studentId: string) {
    return this.teacherStudentsService.assertTeacherOwnsStudent(teacherId, studentId);
  }

  listTeachers() {
    return this.teacherAccountsService.listTeachers();
  }

  getTeacherMe(teacherId: string) {
    return this.teacherAccountsService.getTeacherMe(teacherId);
  }

  updateTeacherProfile(
    teacherId: string,
    firstName: string | null | undefined,
    lastName: string | null | undefined,
    middleName?: string | null,
  ) {
    return this.teacherAccountsService.updateTeacherProfile(
      teacherId,
      firstName,
      lastName,
      middleName,
    );
  }

  changeTeacherPassword(
    teacherId: string,
    currentPassword: string | null | undefined,
    newPassword: string | null | undefined,
  ) {
    return this.teacherAccountsService.changeTeacherPassword(
      teacherId,
      currentPassword,
      newPassword,
    );
  }

  createTeacher(input: {
    login: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    password?: string | null;
    generatePassword?: boolean;
  }) {
    return this.teacherAccountsService.createTeacher(input);
  }

  deleteTeacher(teacherId: string, actorTeacherId: string) {
    return this.teacherAccountsService.deleteTeacher(teacherId, actorTeacherId);
  }

  listStudents(leaderTeacherId: string, query?: string) {
    return this.teacherStudentsService.listStudents(leaderTeacherId, query);
  }

  getStudentProfileDetails(teacherId: string, studentId: string, courseId?: string) {
    return this.teacherStudentsService.getStudentProfileDetails(teacherId, studentId, courseId);
  }

  createStudent(
    login: string,
    leaderTeacherId: string,
    firstName?: string | null,
    lastName?: string | null,
  ) {
    return this.teacherStudentsService.createStudent(login, leaderTeacherId, firstName, lastName);
  }

  updateStudentProfile(
    studentId: string,
    leaderTeacherId: string,
    firstName?: string | null,
    lastName?: string | null,
  ) {
    return this.teacherStudentsService.updateStudentProfile(
      studentId,
      leaderTeacherId,
      firstName,
      lastName,
    );
  }

  resetPassword(studentId: string, leaderTeacherId: string) {
    return this.teacherStudentsService.resetPassword(studentId, leaderTeacherId);
  }

  transferStudent(studentId: string, leaderTeacherId: string, nextTeacherId: string) {
    return this.teacherStudentsService.transferStudent(studentId, leaderTeacherId, nextTeacherId);
  }

  deleteStudent(studentId: string, leaderTeacherId: string) {
    return this.teacherStudentsService.deleteStudent(studentId, leaderTeacherId);
  }
}
