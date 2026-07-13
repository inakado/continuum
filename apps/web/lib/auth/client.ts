import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';
import { z } from 'zod';
import { ApiError } from '@/lib/api/client';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

const client = createAuthClient({
  baseURL: apiBaseUrl,
  basePath: '/auth',
  plugins: [usernameClient()],
  fetchOptions: { credentials: 'include' },
});

const AuthRoleSchema = z.enum(['admin', 'teacher', 'student']);
const AuthUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: AuthRoleSchema,
  isActive: z.literal(true),
});
const AuthSessionSchema = z.object({ user: AuthUserSchema });

export type AuthPrincipal = {
  id: string;
  login: string;
  role: z.infer<typeof AuthRoleSchema>;
};

const mapPrincipal = (value: unknown): AuthPrincipal => {
  const parsed = AuthUserSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(500, 'Authentication response is invalid', 'AUTH_RESPONSE_INVALID');
  }
  return { id: parsed.data.id, login: parsed.data.username, role: parsed.data.role };
};

const mapError = (error: {
  status?: number;
  statusCode?: number;
  message?: string;
  code?: string;
}) =>
  new ApiError(
    error.status ?? error.statusCode ?? 500,
    error.message || 'Authentication request failed',
    error.code,
  );

export const authApi = {
  async signIn(login: string, password: string) {
    const result = await client.signIn.username({ username: login, password });
    if (result.error) throw mapError(result.error);
    return { user: mapPrincipal(result.data?.user) };
  },

  async getSession(): Promise<{ user: AuthPrincipal } | null> {
    const result = await client.getSession();
    if (result.error) throw mapError(result.error);
    if (!result.data) return null;
    const session = AuthSessionSchema.safeParse(result.data);
    if (!session.success) {
      throw new ApiError(500, 'Authentication response is invalid', 'AUTH_RESPONSE_INVALID');
    }
    return { user: mapPrincipal(session.data.user) };
  },

  async signOut() {
    const result = await client.signOut();
    if (result.error) throw mapError(result.error);
    return result.data;
  },
};
