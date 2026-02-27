import type { NextRequest } from "next/server";
import { z } from "zod";
import { getRouteAuthContext } from "@/server/auth/context";
import { isJsonRequest, parseJsonSafely } from "@/server/http/request";
import { jsonError, jsonNoStore } from "@/server/http/response";
import { lockProblemStatementForUser } from "@/server/problem-statements/service";
import { enforceSameOrigin } from "@/server/security/csrf";
import {
  enforceIpRateLimit,
  enforceUserRateLimit,
} from "@/server/security/rate-limit";

const lockRequestSchema = z.object({
  problemStatementId: z
    .string()
    .trim()
    .min(1, "Problem statement is required."),
});

export async function POST(request: NextRequest) {
  const csrfResponse = enforceSameOrigin(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const ipRateLimitResponse = await enforceIpRateLimit({
    policy: "problem_lock_ip",
    request,
  });
  if (ipRateLimitResponse) {
    return ipRateLimitResponse;
  }

  if (!isJsonRequest(request)) {
    return jsonError("Content-Type must be application/json.", 415);
  }

  const body = await parseJsonSafely(request);
  if (body === null) {
    return jsonError("Invalid JSON payload.", 400);
  }

  const parsed = lockRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid payload.",
      400,
    );
  }

  const context = await getRouteAuthContext();
  if (!context.ok) {
    return context.response;
  }

  const userRateLimitResponse = await enforceUserRateLimit({
    policy: "problem_lock_user",
    request,
    userId: context.user.id,
  });
  if (userRateLimitResponse) {
    return userRateLimitResponse;
  }

  const result = await lockProblemStatementForUser({
    problemStatementId: parsed.data.problemStatementId,
    supabase: context.supabase,
    userId: context.user.id,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonNoStore(result.data, result.status);
}
