import { z } from "zod";

import {
  ApiClientError,
  REFRESH_WINDOW_MS,
  api,
  configureApi,
  type Session,
} from "@/api/client";
import { API_BASE, API_FALLBACK_BASE } from "@/config";
import { shouldRetry } from "@/api/queryClient";

jest.mock("@/config", () => ({
  API_BASE: "https://www.agrograinhub.com/api/v1",
  API_FALLBACK_BASE: "https://www.agrograinhub.bg/api/v1",
  USER_AGENT: "AgroMobile/1.0.0 (iPhone)",
}));

const DAY = 86_400_000;
const schema = z.object({ hello: z.string() });

let session: Session | null;
const setSession = jest.fn<Promise<void>, [Session | null]>();
const onUnauthorized = jest.fn();

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();

beforeEach(() => {
  jest.resetAllMocks();
  // resetAllMocks clears implementations, so the stub is re-armed every time.
  setSession.mockImplementation(async (next) => {
    session = next;
  });
  session = { token: "tok-1", expiresAt: new Date(Date.now() + 25 * DAY).toISOString() };
  configureApi({ getSession: () => session, setSession, onUnauthorized });
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("api()", () => {
  it("sends the bearer token and a recognisable User-Agent, and unwraps data", async () => {
    fetchMock.mockResolvedValue(json({ data: { hello: "world" } }));

    await expect(api("/x", { schema })).resolves.toEqual({ hello: "world" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/x$/);
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-1");
    expect(headers["User-Agent"]).toMatch(/^AgroMobile\/.+\((iPhone|Android)\)$/);
  });

  it("sends JSON bodies with a content type, and none on GET", async () => {
    fetchMock.mockResolvedValue(json({ data: { hello: "x" } }));
    await api("/x", { method: "POST", body: { a: 1 }, schema });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe('{"a":1}');
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    fetchMock.mockResolvedValue(json({ data: { hello: "x" } }));
    await api("/x", { schema });
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("omits the token when auth is false", async () => {
    fetchMock.mockResolvedValue(json({ data: { hello: "x" } }));
    await api("/auth/login", { method: "POST", body: {}, schema, auth: false });
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("maps the server's error envelope to a typed error", async () => {
    fetchMock.mockResolvedValue(
      json(
        {
          error: {
            code: "device_in_use",
            message: "Профилът вече се използва.",
            otherDevice: "iOS устройство",
          },
        },
        409,
      ),
    );

    const error = await api("/auth/login", { schema, auth: false }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: "device_in_use",
      status: 409,
      message: "Профилът вече се използва.",
      otherDevice: "iOS устройство",
    });
  });

  it("carries the field of a validation error and the Retry-After of a throttle", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "validation_failed", message: "Грешен имейл.", field: "email" } }, 400),
    );
    expect(await api("/x", { schema }).catch((e) => e)).toMatchObject({ field: "email" });

    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "rate_limited", message: "Бавно." } }, 429, { "Retry-After": "30" }),
    );
    expect(await api("/x", { schema }).catch((e) => e)).toMatchObject({
      code: "rate_limited",
      retryAfter: 30,
    });
  });

  it("calls onUnauthorized on a 401, but not for the login call itself", async () => {
    const unauthorized = json({ error: { code: "unauthorized", message: "x" } }, 401);

    fetchMock.mockResolvedValueOnce(unauthorized.clone());
    await api("/me", { schema }).catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(unauthorized.clone());
    await api("/auth/login", { schema, auth: false }).catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not treat a gate as a sign-out", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: "subscription_inactive", message: "x" } }, 403),
    );
    await api("/home", { schema }).catch(() => undefined);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("reports a dead connection as a connectivity error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    const error = await api("/x", { schema }).catch((e) => e);
    expect(error).toMatchObject({ code: "network" });
    expect(error.isConnectivity).toBe(true);
  });

  it("turns a non-JSON gateway page into a server_error", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    expect(await api("/x", { schema }).catch((e) => e)).toMatchObject({
      code: "server_error",
      status: 502,
    });
  });

  it("rejects a response that does not match the contract", async () => {
    fetchMock.mockResolvedValue(json({ data: { hello: 42 } }));
    expect(await api("/x", { schema }).catch((e) => e)).toMatchObject({ code: "bad_response" });
  });

  it("uses an explicit token without refreshing (sign-out outlives the session)", async () => {
    session = { token: "old", expiresAt: new Date(Date.now() + DAY).toISOString() };
    fetchMock.mockResolvedValue(json({ data: { hello: "x" } }));

    await api("/auth/logout", { method: "POST", schema, token: "captured" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe(
      "Bearer captured",
    );
  });
});

describe("token refresh", () => {
  const nearExpiry = () => ({
    token: "tok-old",
    expiresAt: new Date(Date.now() + REFRESH_WINDOW_MS - 60_000).toISOString(),
  });

  const refreshed = {
    data: { token: "tok-new", expiresAt: new Date(Date.now() + 30 * DAY).toISOString() },
  };

  it("does not refresh a token with plenty of life left", async () => {
    fetchMock.mockResolvedValue(json({ data: { hello: "x" } }));
    await api("/x", { schema });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes first, then retries the request with the new token", async () => {
    session = nearExpiry();
    fetchMock.mockImplementation(async (url) =>
      url.endsWith("/auth/refresh") ? json(refreshed) : json({ data: { hello: "x" } }),
    );

    await api("/x", { schema });

    expect(fetchMock.mock.calls.map(([u]) => u.split("/api/v1")[1])).toEqual(["/auth/refresh", "/x"]);
    expect(setSession).toHaveBeenCalledWith({
      token: "tok-new",
      expiresAt: refreshed.data.expiresAt,
    });
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-new",
    );
  });

  it("is single-flight: parallel requests share one refresh", async () => {
    session = nearExpiry();
    fetchMock.mockImplementation(async (url) =>
      url.endsWith("/auth/refresh") ? json(refreshed) : json({ data: { hello: "x" } }),
    );

    await Promise.all([api("/a", { schema }), api("/b", { schema }), api("/c", { schema })]);

    const refreshCalls = fetchMock.mock.calls.filter(([u]) => u.endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("keeps using the current token when the refresh itself fails", async () => {
    session = nearExpiry();
    fetchMock.mockImplementation(async (url) =>
      url.endsWith("/auth/refresh")
        ? json({ error: { code: "server_error", message: "x" } }, 500)
        : json({ data: { hello: "x" } }),
    );

    await expect(api("/x", { schema })).resolves.toEqual({ hello: "x" });
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-old",
    );
  });
});

describe("retry policy", () => {
  const err = (code: ApiClientError["code"], status = 0) => new ApiClientError(code, "x", { status });

  it("retries connectivity failures and server errors, a couple of times", () => {
    expect(shouldRetry(0, err("network"))).toBe(true);
    expect(shouldRetry(0, err("timeout"))).toBe(true);
    expect(shouldRetry(1, err("server_error", 503))).toBe(true);
    expect(shouldRetry(2, err("network"))).toBe(false);
  });

  describe("API domain failover", () => {
    it("retries a gateway-unavailable response on the alternate domain", async () => {
      if (!API_FALLBACK_BASE) throw new Error("The production fallback domain is not configured");
      fetchMock
        .mockResolvedValueOnce(new Response("no available server", { status: 503 }))
        .mockResolvedValueOnce(json({ data: { hello: "world" } }));

      await expect(api("/x", { schema })).resolves.toEqual({ hello: "world" });

      const requestedUrls = fetchMock.mock.calls.map(([url]) => url);
      expect(requestedUrls).toHaveLength(2);
      expect(new Set(requestedUrls)).toEqual(new Set([
        `${API_BASE}/x`,
        `${API_FALLBACK_BASE}/x`,
      ]));
    });

    it("retries a login on the alternate domain after a gateway-unavailable response", async () => {
      if (!API_FALLBACK_BASE) throw new Error("The production fallback domain is not configured");
      fetchMock
        .mockResolvedValueOnce(new Response("no available server", { status: 503 }))
        .mockResolvedValueOnce(json({ data: { hello: "world" } }));

      await expect(
        api("/auth/login", { method: "POST", body: {}, schema, auth: false }),
      ).resolves.toEqual({ hello: "world" });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const requestedUrls = fetchMock.mock.calls.map(([url]) => url);
      expect(new Set(requestedUrls)).toEqual(new Set([
        `${API_BASE}/auth/login`,
        `${API_FALLBACK_BASE}/auth/login`,
      ]));
    });

    it("does not switch domains for a normal validation error", async () => {
      fetchMock.mockResolvedValueOnce(
        json({ error: { code: "validation_failed", message: "Грешен имейл." } }, 400),
      );

      await expect(api("/auth/login", { method: "POST", body: {}, schema, auth: false }))
        .rejects.toMatchObject({ code: "validation_failed", status: 400 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("fails over read requests after a network failure", async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError("Network request failed"))
        .mockResolvedValueOnce(json({ data: { hello: "world" } }));

      await expect(api("/x", { schema })).resolves.toEqual({ hello: "world" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not replay writes on another domain after a gateway error", async () => {
      fetchMock.mockResolvedValueOnce(new Response("no available server", { status: 503 }));

      await expect(
        api("/market/alerts", { method: "POST", body: {}, schema }),
      ).rejects.toMatchObject({ code: "server_error", status: 503 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("never retries a verdict from the server", () => {
    for (const [code, status] of [
      ["unauthorized", 401],
      ["subscription_inactive", 403],
      ["trade_access", 403],
      ["not_found", 404],
      ["validation_failed", 400],
    ] as const) {
      expect(shouldRetry(0, err(code, status))).toBe(false);
    }
  });

  it("does not retry unknown errors", () => {
    expect(shouldRetry(0, new Error("boom"))).toBe(false);
  });
});
