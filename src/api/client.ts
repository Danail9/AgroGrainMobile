import type { z } from "zod";

import { API_BASE, USER_AGENT } from "@/config";
import { apiErrorSchema, refreshResultSchema } from "@/api/schemas";

export type ServerErrorCode = z.infer<typeof apiErrorSchema>["error"]["code"];
/** Server codes plus the three failures that never reach the server. */
export type ClientErrorCode = ServerErrorCode | "network" | "timeout" | "bad_response";

export class ApiClientError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;
  readonly field?: string;
  readonly otherDevice?: string;
  readonly retryAfter?: number;

  constructor(
    code: ClientErrorCode,
    message: string,
    extra: {
      status?: number;
      field?: string;
      otherDevice?: string;
      retryAfter?: number;
    } = {},
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = extra.status ?? 0;
    this.field = extra.field;
    this.otherDevice = extra.otherDevice;
    this.retryAfter = extra.retryAfter;
  }

  /** The device is offline or the request timed out: cached data is still valid. */
  get isConnectivity() {
    return this.code === "network" || this.code === "timeout";
  }
}

export function isApiError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export type Session = { token: string; expiresAt: string };

type Hooks = {
  getSession: () => Session | null;
  setSession: (session: Session | null) => Promise<void> | void;
  /** The server said the token is dead (revoked, expired, account blocked). */
  onUnauthorized: () => void;
};

let hooks: Hooks | null = null;

/** Wired once by the auth provider; keeps this module free of React. */
export function configureApi(next: Hooks) {
  hooks = next;
}

const REQUEST_TIMEOUT_MS = 20_000;
/** A token is swapped for a fresh one once it is within this window of expiry. */
export const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

let refreshing: Promise<void> | null = null;

async function rawFetch(url: string, init: RequestInit, signal?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new ApiClientError("timeout", "Заявката отне твърде дълго. Опитай отново.");
    }
    // Cancelled by the caller (screen closed, query superseded): not an error.
    if (signal?.aborted) throw error;
    throw new ApiClientError("network", "Няма връзка с интернет.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toError(response: Response, body: unknown) {
  const parsed = apiErrorSchema.safeParse(body);
  const retryHeader = Number(response.headers.get("Retry-After"));

  if (parsed.success) {
    const { code, message, field, otherDevice, retryAfter } = parsed.data.error;
    return new ApiClientError(code, message, {
      status: response.status,
      field,
      otherDevice,
      retryAfter: retryAfter ?? (Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined),
    });
  }

  // A proxy or gateway answered with something that is not our envelope.
  return new ApiClientError("server_error", "Сървърът не отговаря. Опитай отново.", {
    status: response.status,
  });
}

async function refreshSession() {
  const session = hooks?.getSession();
  if (!session) return;

  const response = await rawFetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: headers(session.token),
  });
  const body = await readBody(response);
  if (!response.ok) throw toError(response, body);

  const result = refreshResultSchema.parse((body as { data: unknown }).data);
  await hooks?.setSession(result);
}

/**
 * Swaps a token that is close to expiry. Single-flight: two screens asking at
 * once must not both rotate, because the second would present a token the
 * first has already retired. A failed refresh is not fatal; the current token
 * keeps working until the server says otherwise.
 */
async function refreshIfDue() {
  const session = hooks?.getSession();
  if (!session) return;
  if (Date.parse(session.expiresAt) - Date.now() > REFRESH_WINDOW_MS) return;

  refreshing ??= refreshSession()
    .catch(() => undefined)
    .finally(() => {
      refreshing = null;
    });
  await refreshing;
}

function headers(token?: string, hasBody = false): Record<string, string> {
  return {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type RequestOptions<T> = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema: z.ZodType<T>;
  /** Defaults to true. Sign-in and the public version check pass false. */
  auth?: boolean;
  /** Send this token instead of the stored one (sign-out outlives the stored session). */
  token?: string;
  signal?: AbortSignal;
};

/** One typed, validated call to the portal's `/api/v1`. */
export async function api<T>(path: string, options: RequestOptions<T>): Promise<T> {
  const { method = "GET", body, schema, auth = true, signal } = options;

  if (auth && !options.token) await refreshIfDue();
  const token = options.token ?? (auth ? hooks?.getSession()?.token : undefined);

  const response = await rawFetch(
    `${API_BASE}${path}`,
    {
      method,
      headers: headers(token, body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    signal,
  );

  const payload = await readBody(response);

  if (!response.ok) {
    const error = toError(response, payload);
    if (auth && error.code === "unauthorized") hooks?.onUnauthorized();
    throw error;
  }

  const data = (payload as { data?: unknown } | null)?.data;
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiClientError("bad_response", "Неочакван отговор от сървъра. Опитай отново.", {
      status: response.status,
    });
  }
  return parsed.data;
}
