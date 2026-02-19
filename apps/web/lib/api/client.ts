export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  skipAuthRefresh?: boolean;
};

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
let refreshPromise: Promise<void> | null = null;

const NO_REFRESH_PATHS = new Set(["/auth/login", "/auth/refresh", "/auth/logout"]);

const getPathname = (path: string) => {
  const idx = path.indexOf("?");
  return idx === -1 ? path : path.slice(0, idx);
};

const shouldTryRefresh = (path: string, options: RequestOptions) => {
  if (options.skipAuthRefresh) return false;
  return !NO_REFRESH_PATHS.has(getPathname(path));
};

const parseJsonSafe = (text: string) => {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const buildApiError = (res: Response, data: unknown) => {
  let code: string | undefined;
  let message: string | undefined;

  if (typeof data === "object" && data) {
    const asRecord = data as Record<string, unknown>;
    if (typeof asRecord.code === "string") {
      code = asRecord.code;
    }

    const rawMessage = asRecord.message;
    if (typeof rawMessage === "string") {
      message = rawMessage;
    } else if (Array.isArray(rawMessage)) {
      const first = rawMessage.find((item) => typeof item === "string");
      if (typeof first === "string") {
        message = first;
      }
    } else if (rawMessage && typeof rawMessage === "object") {
      const nested = rawMessage as Record<string, unknown>;
      if (typeof nested.message === "string") {
        message = nested.message;
      }
      if (!code && typeof nested.code === "string") {
        code = nested.code;
      }
    }
  }

  return new ApiError(res.status, message || res.statusText || "Request failed", code);
};

const requestRaw = async (path: string, options: RequestOptions = {}) => {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    cache: "no-store",
    credentials: "include",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  const data = parseJsonSafe(text);
  return { res, data };
};

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { res, data } = await requestRaw("/auth/refresh", {
        method: "POST",
        skipAuthRefresh: true,
      });
      if (!res.ok) {
        throw buildApiError(res, data);
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  await refreshPromise;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const first = await requestRaw(path, options);
  const { res, data } = first;
  if (!res.ok) {
    if (res.status === 401 && shouldTryRefresh(path, options)) {
      try {
        await refreshAccessToken();
        const second = await requestRaw(path, { ...options, skipAuthRefresh: true });
        if (second.res.ok) {
          return second.data as T;
        }
        throw buildApiError(second.res, second.data);
      } catch {
        throw buildApiError(res, data);
      }
    }
    throw buildApiError(res, data);
  }

  return data as T;
}
