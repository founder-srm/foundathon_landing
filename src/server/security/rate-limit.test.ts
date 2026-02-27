import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  ratelimitConstructor: vi.fn(),
  redisConstructor: vi.fn(),
  slidingWindow: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    constructor(config: unknown) {
      mocks.redisConstructor(config);
    }
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow(limit: number, window: string) {
      return mocks.slidingWindow(limit, window);
    }

    constructor(config: unknown) {
      mocks.ratelimitConstructor(config);
    }

    limit = mocks.limit;
  },
}));

const ENV_KEYS = [
  "FOUNDATHON_NODE_ENV",
  "NODE_ENV",
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_REST_URL",
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

const restoreEnv = () => {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
};

describe("rate-limit", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.limit.mockReset();
    mocks.ratelimitConstructor.mockReset();
    mocks.redisConstructor.mockReset();
    mocks.slidingWindow.mockReset();

    restoreEnv();
    process.env.NODE_ENV = "test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("allows requests under the policy limit", async () => {
    mocks.limit.mockResolvedValue({
      limit: 20,
      remaining: 19,
      reset: Date.now() + 30_000,
      success: true,
    });

    const { enforceIpRateLimit } = await import("@/server/security/rate-limit");
    const response = await enforceIpRateLimit({
      policy: "auth_login_ip",
      request: new Request("http://localhost/api/auth/login", {
        headers: { "x-real-ip": "1.2.3.4" },
      }),
    });

    expect(response).toBeNull();
  });

  it("returns 429 with rate limit headers when blocked", async () => {
    const now = Date.now();
    mocks.limit.mockResolvedValue({
      limit: 20,
      remaining: 0,
      reset: now + 15_000,
      success: false,
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { enforceIpRateLimit } = await import("@/server/security/rate-limit");
    const response = await enforceIpRateLimit({
      policy: "auth_login_ip",
      request: new Request("http://localhost/api/auth/login", {
        headers: { "x-real-ip": "1.2.3.4" },
      }),
    });

    expect(response?.status).toBe(429);
    expect(await response?.json()).toEqual({
      code: "RATE_LIMITED",
      error: "Too many requests. Please try again later.",
    });
    expect(response?.headers.get("Retry-After")).toBeTruthy();
    expect(response?.headers.get("X-RateLimit-Limit")).toBe("20");
    expect(response?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response?.headers.get("X-RateLimit-Reset")).toBeTruthy();

    warnSpy.mockRestore();
  });

  it("fails open in development mode when Redis is unavailable", async () => {
    process.env.NODE_ENV = "production";
    process.env.FOUNDATHON_NODE_ENV = "development";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;

    const { enforceIpRateLimit } = await import("@/server/security/rate-limit");
    const response = await enforceIpRateLimit({
      policy: "auth_login_ip",
      request: new Request("http://localhost/api/auth/login"),
    });

    expect(response).toBeNull();
  });

  it("fails closed in production when Redis is unavailable", async () => {
    process.env.NODE_ENV = "production";
    process.env.FOUNDATHON_NODE_ENV = "production";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { enforceIpRateLimit } = await import("@/server/security/rate-limit");
    const response = await enforceIpRateLimit({
      policy: "auth_login_ip",
      request: new Request("http://localhost/api/auth/login"),
    });

    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({
      code: "RATE_LIMIT_UNAVAILABLE",
      error: "Rate limit service is unavailable. Please try again later.",
    });

    warnSpy.mockRestore();
  });
});
