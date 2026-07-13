import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionAuthGuard } from '../src/auth/guards/session-auth.guard';

describe('SessionAuthGuard', () => {
  const request: { headers: Record<string, string>; user?: unknown; session?: unknown } = {
    headers: {},
  };
  const handler = () => undefined;
  class TestController {}
  const context = {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => request }),
  };
  const reflector = { getAllAndOverride: vi.fn() };
  const getSession = vi.fn();
  const betterAuth = { api: { getSession } };
  const prisma = { session: { deleteMany: vi.fn() } };
  const guard = new SessionAuthGuard(
    reflector as never,
    betterAuth as never,
    prisma as never,
  );

  beforeEach(() => {
    request.headers = {};
    delete request.user;
    delete request.session;
    vi.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
  });

  it('does not query sessions for explicitly anonymous routes', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(context as never)).resolves.toBe(true);

    expect(getSession).not.toHaveBeenCalled();
  });

  it('maps a Better Auth session to the existing AuthUser principal', async () => {
    const session = {
      session: { id: 'session-1' },
      user: {
        id: 'teacher-1',
        username: 'teacher1',
        role: 'teacher',
        isActive: true,
      },
    };
    getSession.mockResolvedValue(session);

    await expect(guard.canActivate(context as never)).resolves.toBe(true);

    expect(request.user).toEqual({ id: 'teacher-1', login: 'teacher1', role: 'teacher' });
    expect(request.session).toBe(session);
  });

  it('rejects requests without a Better Auth session', async () => {
    getSession.mockResolvedValue(null);

    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      response: { code: 'AUTH_REQUIRED' },
    });
  });

  it('revokes all sessions for an inactive user', async () => {
    getSession.mockResolvedValue({
      session: { id: 'session-1' },
      user: {
        id: 'student-1',
        username: 'student1',
        role: 'student',
        isActive: false,
      },
    });

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
    });
  });

  it('rejects malformed session identity', async () => {
    getSession.mockResolvedValue({
      session: { id: 'session-1' },
      user: {
        id: 'user-1',
        username: null,
        role: 'teacher',
        isActive: true,
      },
    });

    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      response: { code: 'SESSION_INVALID' },
    });
  });
});
