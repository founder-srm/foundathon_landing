import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isFoundathonDevelopment } from "@/server/env";
import {
  jsonRateLimited,
  jsonRateLimitUnavailable,
} from "@/server/http/response";
import { getClientIp } from "@/server/security/client-ip";

const POLICY_CONFIG = {
  auth_callback_ip: { keyType: "ip", limit: 60, window: "10 m" },
  auth_login_ip: { keyType: "ip", limit: 20, window: "10 m" },
  presentation_upload_ip: { keyType: "ip", limit: 10, window: "1 h" },
  presentation_upload_user: { keyType: "user", limit: 5, window: "1 h" },
  problem_lock_ip: { keyType: "ip", limit: 40, window: "10 m" },
  problem_lock_user: { keyType: "user", limit: 10, window: "10 m" },
  register_create_ip: { keyType: "ip", limit: 20, window: "10 m" },
  register_create_user: { keyType: "user", limit: 5, window: "10 m" },
  register_modify_ip: { keyType: "ip", limit: 60, window: "10 m" },
  register_modify_user: { keyType: "user", limit: 20, window: "10 m" },
} as const;

export type RateLimitPolicy = keyof typeof POLICY_CONFIG;

type RateLimitKeyType = "ip" | "user";

type EnforceRateLimitInput = {
  key: string;
  keyType: RateLimitKeyType;
  policy: RateLimitPolicy;
  request: Request;
  userId?: string;
};

let cachedRedis: Redis | null | undefined;
const rateLimiterCache = new Map<RateLimitPolicy, Ratelimit>();

const isStrictFailureMode = () =>
  process.env.NODE_ENV === "production" && !isFoundathonDevelopment();

const toSafeUserId = (value: string | undefined) =>
  typeof value === "string" && value.length > 0 ? value.slice(0, 8) : null;

const logRateLimitDenied = ({
  ip,
  keyType,
  policy,
  route,
  userId,
}: {
  ip: string;
  keyType: RateLimitKeyType;
  policy: RateLimitPolicy;
  route: string;
  userId?: string;
}) => {
  console.warn(
    JSON.stringify({
      event: "security.rate_limit_denied",
      ip,
      keyType,
      policy,
      route,
      userId: toSafeUserId(userId),
    }),
  );
};

const logRateLimitUnavailable = ({
  error,
  ip,
  keyType,
  policy,
  route,
  userId,
}: {
  error: unknown;
  ip: string;
  keyType: RateLimitKeyType;
  policy: RateLimitPolicy;
  route: string;
  userId?: string;
}) => {
  const message = error instanceof Error ? error.message : "unknown";
  console.warn(
    JSON.stringify({
      event: "security.rate_limit_unavailable",
      ip,
      keyType,
      message,
      policy,
      route,
      userId: toSafeUserId(userId),
    }),
  );
};

const getRedisClient = () => {
  if (cachedRedis !== undefined) {
    return cachedRedis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    cachedRedis = null;
    return cachedRedis;
  }

  cachedRedis = new Redis({ token, url });
  return cachedRedis;
};

const getLimiter = (policy: RateLimitPolicy) => {
  const existing = rateLimiterCache.get(policy);
  if (existing) {
    return existing;
  }

  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  const config = POLICY_CONFIG[policy];
  const limiter = new Ratelimit({
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    redis,
  });

  rateLimiterCache.set(policy, limiter);
  return limiter;
};

const getRoutePath = (request: Request) => {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
};

const toRateLimitHeaders = ({
  limit,
  remaining,
  reset,
}: {
  limit: number;
  remaining: number;
  reset: number;
}) => {
  const now = Date.now();
  const resetMs = Number.isFinite(reset) ? reset : now + 60_000;

  return {
    limit,
    remaining,
    resetEpochSeconds: Math.floor(resetMs / 1000),
    retryAfterSeconds: Math.max(1, Math.ceil((resetMs - now) / 1000)),
  };
};

const enforceRateLimit = async ({
  key,
  keyType,
  policy,
  request,
  userId,
}: EnforceRateLimitInput) => {
  const route = getRoutePath(request);
  const ip = getClientIp(request);
  const limiter = getLimiter(policy);
  if (!limiter) {
    if (!isStrictFailureMode()) {
      return null;
    }

    logRateLimitUnavailable({
      error: "missing redis credentials",
      ip,
      keyType,
      policy,
      route,
      userId,
    });
    return jsonRateLimitUnavailable();
  }

  try {
    const result = await limiter.limit(`${policy}:${key}`);
    if (result.success) {
      return null;
    }

    logRateLimitDenied({ ip, keyType, policy, route, userId });

    return jsonRateLimited(
      toRateLimitHeaders({
        limit:
          typeof result.limit === "number"
            ? result.limit
            : POLICY_CONFIG[policy].limit,
        remaining: typeof result.remaining === "number" ? result.remaining : 0,
        reset:
          typeof result.reset === "number" ? result.reset : Date.now() + 60_000,
      }),
    );
  } catch (error) {
    logRateLimitUnavailable({ error, ip, keyType, policy, route, userId });
    if (!isStrictFailureMode()) {
      return null;
    }

    return jsonRateLimitUnavailable();
  }
};

export const enforceIpRateLimit = ({
  policy,
  request,
}: {
  policy: RateLimitPolicy;
  request: Request;
}) =>
  enforceRateLimit({
    key: getClientIp(request),
    keyType: "ip",
    policy,
    request,
  });

export const enforceUserRateLimit = ({
  policy,
  request,
  userId,
}: {
  policy: RateLimitPolicy;
  request: Request;
  userId: string;
}) =>
  enforceRateLimit({
    key: userId,
    keyType: "user",
    policy,
    request,
    userId,
  });
