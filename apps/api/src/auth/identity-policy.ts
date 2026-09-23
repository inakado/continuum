import { BadRequestException } from '@nestjs/common';

const LOGIN_PATTERN = /^[a-z0-9._-]+$/;

export const normalizeLogin = (raw: string) => {
  const login = raw.trim().toLowerCase();
  if (login.length < 3 || login.length > 64 || !LOGIN_PATTERN.test(login)) {
    throw new BadRequestException({
      code: 'INVALID_LOGIN',
      message: 'Логин: от 3 до 64 символов; латинские буквы, цифры, точка, дефис или подчёркивание.',
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
