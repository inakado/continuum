import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  PDF_TTL_MAX_SEC,
  STUDENT_PDF_TTL_DEFAULT_SEC,
  TEACHER_PDF_TTL_DEFAULT_SEC,
  UnitPdfTarget,
  UNIT_PDF_TARGETS,
} from './unit-pdf.constants';

@Injectable()
export class UnitPdfPolicyService {
  parseTargetOrThrow(raw: unknown): UnitPdfTarget {
    if (raw === 'theory' || raw === 'method') {
      return raw;
    }

    throw new BadRequestException({
      code: 'INVALID_PDF_TARGET',
      message: `target must be one of: ${UNIT_PDF_TARGETS.join(' | ')}`,
    });
  }

  resolveTtlForRole(role: Role, rawValue: unknown): number {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return role === Role.teacher ? TEACHER_PDF_TTL_DEFAULT_SEC : STUDENT_PDF_TTL_DEFAULT_SEC;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      throw new BadRequestException({
        code: 'INVALID_TTL',
        message: 'ttlSec must be a positive integer',
      });
    }

    if (parsed > PDF_TTL_MAX_SEC) {
      throw new BadRequestException({
        code: 'TTL_TOO_LARGE',
        message: `ttlSec must be <= ${PDF_TTL_MAX_SEC}`,
      });
    }

    return parsed;
  }
}
