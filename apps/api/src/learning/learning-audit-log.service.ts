import { Inject, Injectable } from '@nestjs/common';
import { EventCategory, Role } from '@prisma/client';
import { EventsLogService } from '../events/events-log.service';

@Injectable()
export class LearningAuditLogService {
  constructor(@Inject(EventsLogService) private readonly eventsLogService: EventsLogService) {}

  async appendTeacherAdminEvent(input: {
    eventType: string;
    teacherId: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
  }) {
    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: input.eventType,
      actorUserId: input.teacherId,
      actorRole: Role.teacher,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
    });
  }

  async appendStudentLearningEvent(input: {
    eventType: string;
    studentId: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
  }) {
    await this.eventsLogService.append({
      category: EventCategory.learning,
      eventType: input.eventType,
      actorUserId: input.studentId,
      actorRole: Role.student,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
    });
  }

  async appendStudentSystemEvent(input: {
    eventType: string;
    studentId: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
  }) {
    await this.eventsLogService.append({
      category: EventCategory.system,
      eventType: input.eventType,
      actorUserId: input.studentId,
      actorRole: Role.student,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
    });
  }
}
