import { BadRequestException } from '@nestjs/common';
import { StudentTaskStatus } from '@prisma/client';
import { randomInt } from 'crypto';

const PASSWORD_LENGTH = 10;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const PASSWORD_CHARS = `${LETTERS}${DIGITS}`;
const MAX_NAME_LENGTH = 80;
const MIN_PASSWORD_LENGTH = 8;

const pickRandom = (source: string) => source[randomInt(0, source.length)];

const shuffle = (items: string[]) => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

export const generatePassword = () => {
  const chars = [pickRandom(LETTERS), pickRandom(DIGITS)];
  while (chars.length < PASSWORD_LENGTH) {
    chars.push(pickRandom(PASSWORD_CHARS));
  }
  return shuffle(chars).join('');
};

export const normalizeName = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new BadRequestException('Имя слишком длинное');
  }
  return trimmed;
};

export const buildLeadTeacherDisplayName = (teacher: {
  login: string;
  teacherProfile?: {
    firstName?: string | null;
    middleName?: string | null;
  } | null;
}) => {
  const firstName = teacher.teacherProfile?.firstName?.trim() ?? '';
  const middleName = teacher.teacherProfile?.middleName?.trim() ?? '';
  const parts = [firstName, middleName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' ');
  }
  return teacher.login;
};

export const normalizeRequiredName = (
  value: string | null | undefined,
  code: string,
  message: string,
) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new BadRequestException({ code, message });
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new BadRequestException({
      code,
      message: 'Значение слишком длинное',
    });
  }
  return trimmed;
};

export const assertPasswordStrength = (password: string) => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException({
      code: 'WEAK_PASSWORD',
      message: 'Password must be at least 8 characters long and contain letters and digits.',
    });
  }

  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasLetter || !hasDigit) {
    throw new BadRequestException({
      code: 'WEAK_PASSWORD',
      message: 'Password must contain both letters and digits.',
    });
  }
};

export const creditedStatuses = new Set<StudentTaskStatus>([
  StudentTaskStatus.correct,
  StudentTaskStatus.accepted,
  StudentTaskStatus.credited_without_progress,
  StudentTaskStatus.teacher_credited,
]);

export const normalizeTaskState = (
  state: {
    status: StudentTaskStatus;
    wrongAttempts: number;
    lockedUntil: Date | null;
    requiredSkipped: boolean;
    activeRevisionId: string;
  } | null,
  activeRevisionId: string | null,
  now: Date,
) => {
  if (!state || !activeRevisionId) {
    return {
      status: StudentTaskStatus.not_started,
      wrongAttempts: 0,
      blockedUntil: null as Date | null,
      requiredSkipped: false,
    };
  }

  if (!creditedStatuses.has(state.status) && state.activeRevisionId !== activeRevisionId) {
    return {
      status: StudentTaskStatus.not_started,
      wrongAttempts: 0,
      blockedUntil: null as Date | null,
      requiredSkipped: false,
    };
  }

  const isBlocked = Boolean(state.lockedUntil && state.lockedUntil > now);
  const status =
    state.status === StudentTaskStatus.blocked && !isBlocked
      ? state.wrongAttempts > 0
        ? StudentTaskStatus.in_progress
        : StudentTaskStatus.not_started
      : state.status;

  return {
    status,
    wrongAttempts: state.wrongAttempts,
    blockedUntil: isBlocked ? state.lockedUntil : null,
    requiredSkipped: state.requiredSkipped,
  };
};
