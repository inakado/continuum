import { BadRequestException } from '@nestjs/common';

const LOGIN_PATTERN = /^[a-z0-9._-]+$/;

export const normalizeLogin = (raw: string) => {
  const login = raw.trim().toLowerCase();
  if (login.length < 3 || login.length > 64 || !LOGIN_PATTERN.test(login)) {
    throw new BadRequestException({
      code: 'INVALID_LOGIN',
      message: 'Login must be 3-64 characters and contain only a-z, 0-9, dot, underscore or hyphen.',
    });
  }
  return login;
};

export const buildTechnicalEmail = (login: string) =>
  `${normalizeLogin(login)}@users.continuum.invalid`;

export const buildIdentityName = ({
  firstName,
  lastName,
  login,
}: {
  firstName?: string | null;
  lastName?: string | null;
  login: string;
}) => [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ') || normalizeLogin(login);
