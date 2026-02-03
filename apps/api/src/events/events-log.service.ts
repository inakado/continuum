import { Injectable } from '@nestjs/common';
import { EventCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AppendEventInput = {
  category: EventCategory;
  eventType: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
};

type ListEventsParams = {
  category: EventCategory;
  limit?: number;
  offset?: number;
  entityType?: string;
  entityId?: string;
};

@Injectable()
export class EventsLogService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: AppendEventInput) {
    const payload = {
      ...(input.payload ?? {}),
      actorRole: input.actorRole ?? null,
    };

    return this.prisma.domainEventLog.create({
      data: {
        category: input.category,
        eventType: input.eventType,
        actorUserId: input.actorUserId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        payload,
      },
    });
  }

  async list(params: ListEventsParams) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    const where: Prisma.DomainEventLogWhereInput = {
      category: params.category,
      ...(params.entityType ? { entityType: params.entityType } : null),
      ...(params.entityId ? { entityId: params.entityId } : null),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.domainEventLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          actorUser: { select: { id: true, login: true, role: true } },
        },
      }),
      this.prisma.domainEventLog.count({ where }),
    ]);

    return { items, total, limit, offset };
  }
}
