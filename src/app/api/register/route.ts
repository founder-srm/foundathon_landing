import type { NextRequest } from "next/server";
import { z } from "zod";
import { UUID_PATTERN } from "@/lib/register-api";
import { teamSubmissionSchema } from "@/lib/register-schema";
import { getRouteAuthContext } from "@/server/auth/context";
import { isJsonRequest, parseJsonSafely } from "@/server/http/request";
import { jsonError, jsonNoStore } from "@/server/http/response";
import {
  createTeam,
  deleteTeamByQueryId,
  listTeams,
} from "@/server/registration/service";
import { enforceSameOrigin } from "@/server/security/csrf";
import {
  enforceIpRateLimit,
  enforceUserRateLimit,
} from "@/server/security/rate-limit";

const createTeamRequestSchema = z.object({
  lockToken: z.string().trim().min(1, "Lock token is required."),
  problemStatementId: z
    .string()
    .trim()
    .min(1, "Problem statement is required."),
  team: teamSubmissionSchema,
});

export async function GET() {
  const context = await getRouteAuthContext();
  if (!context.ok) {
    return context.response;
  }

  const result = await listTeams({
    supabase: context.supabase,
    userId: context.user.id,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonNoStore(result.data, result.status);
}

export async function POST(request: NextRequest) {
  const csrfResponse = enforceSameOrigin(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const ipRateLimitResponse = await enforceIpRateLimit({
    policy: "register_create_ip",
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

  const parsed = createTeamRequestSchema.safeParse(body);
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
    policy: "register_create_user",
    request,
    userId: context.user.id,
  });
  if (userRateLimitResponse) {
    return userRateLimitResponse;
  }

  const result = await createTeam({
    input: parsed.data,
    supabase: context.supabase,
    userEmail: context.user.email,
    userId: context.user.id,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonNoStore(result.data, result.status);
}

export async function DELETE(request: NextRequest) {
  const csrfResponse = enforceSameOrigin(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const ipRateLimitResponse = await enforceIpRateLimit({
    policy: "register_modify_ip",
    request,
  });
  if (ipRateLimitResponse) {
    return ipRateLimitResponse;
  }

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return jsonError("Team id is required.", 400);
  }

  if (!UUID_PATTERN.test(id)) {
    return jsonError("Team id is invalid.", 400);
  }

  const context = await getRouteAuthContext();
  if (!context.ok) {
    return context.response;
  }

  const userRateLimitResponse = await enforceUserRateLimit({
    policy: "register_modify_user",
    request,
    userId: context.user.id,
  });
  if (userRateLimitResponse) {
    return userRateLimitResponse;
  }

  const result = await deleteTeamByQueryId({
    id,
    supabase: context.supabase,
    userId: context.user.id,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonNoStore(result.data, result.status);
}
