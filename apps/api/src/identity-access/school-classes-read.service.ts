import { Inject, Injectable } from '@nestjs/common';
import type { SchoolClass } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchoolClassesReadService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getClasses(teacherId: string): Promise<{ classes: SchoolClass[] }> {
    const classes = await this.prisma.schoolClass.findMany({
      where: { teacherId },
      orderBy: [{ academicYear: 'desc' }, { grade: 'asc' }, { title: 'asc' }],
      include: { _count: { select: { students: true } } },
    });
    return { classes: classes.map((item) => ({
      id: item.id, title: item.title, grade: item.grade, academicYear: item.academicYear,
      isArchived: item.isArchived, studentCount: item._count.students,
    })) };
  }
}
