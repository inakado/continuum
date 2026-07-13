import type { ZodTypeAny } from "zod";

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
};

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { res, data } = await requestRaw(path, options);
  if (!res.ok) {
    throw buildApiError(res, data);
  }

  return data as T;
}

export async function apiRequestParsed<TSchema extends ZodTypeAny>(
  path: string,
  responseSchema: TSchema,
  options: RequestOptions = {},
): Promise<TSchema["_output"]> {
  const data = await apiRequest<unknown>(path, options);
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(
      500,
      `API response validation failed for ${path}`,
      "API_RESPONSE_INVALID",
    );
  }

  return parsed.data;
}
