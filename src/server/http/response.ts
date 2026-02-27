import { NextResponse } from "next/server";

export const JSON_NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export const jsonNoStore = <T>(body: T, status = 200) =>
  NextResponse.json(body, { headers: JSON_NO_STORE_HEADERS, status });

export const jsonError = (
  message: string,
  status: number,
  extras?: Record<string, unknown>,
) => jsonNoStore({ error: message, ...(extras ?? {}) }, status);

type RateLimitHeadersInput = {
  limit: number;
  remaining: number;
  resetEpochSeconds: number;
  retryAfterSeconds: number;
};

const toRateLimitHeaders = ({
  limit,
  remaining,
  resetEpochSeconds,
  retryAfterSeconds,
}: RateLimitHeadersInput) => ({
  ...JSON_NO_STORE_HEADERS,
  "Retry-After": String(retryAfterSeconds),
  "X-RateLimit-Limit": String(limit),
  "X-RateLimit-Remaining": String(remaining),
  "X-RateLimit-Reset": String(resetEpochSeconds),
});

export const jsonRateLimited = ({
  limit,
  remaining,
  resetEpochSeconds,
  retryAfterSeconds,
}: RateLimitHeadersInput) =>
  NextResponse.json(
    {
      code: "RATE_LIMITED",
      error: "Too many requests. Please try again later.",
    },
    {
      headers: toRateLimitHeaders({
        limit,
        remaining,
        resetEpochSeconds,
        retryAfterSeconds,
      }),
      status: 429,
    },
  );

export const jsonRateLimitUnavailable = () =>
  jsonError("Rate limit service is unavailable. Please try again later.", 503, {
    code: "RATE_LIMIT_UNAVAILABLE",
  });
