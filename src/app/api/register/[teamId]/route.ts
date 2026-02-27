import type { NextRequest } from "next/server";
import { z } from "zod";
import { UUID_PATTERN } from "@/lib/register-api";
import { teamSubmissionSchema } from "@/lib/register-schema";
import { getRouteAuthContext } from "@/server/auth/context";
import { isJsonRequest, parseJsonSafely } from "@/server/http/request";
import { jsonError, jsonNoStore } from "@/server/http/response";
import { deleteTeam, getTeam, patchTeam } from "@/server/registration/service";
import { enforceSameOrigin } from "@/server/security/csrf";
import {
  enforceIpRateLimit,
  enforceUserRateLimit,
} from "@/server/security/rate-limit";

type Params = { params: Promise<{ teamId: string }> };

const statementLockPatchSchema = z.object({
  lockToken: z.string().trim().min(1, "Lock token is required."),
  problemStatementId: z
    .string()
    .trim()
    .min(1, "Problem statement is required."),
});

export async function GET(_: NextRequest, { params }: Params) {
  const { teamId } = await params;
  if (!UUID_PATTERN.test(teamId)) {
    return jsonError("Team id is invalid.", 400);
  }

  const context = await getRouteAuthContext();
  if (!context.ok) {
    return context.response;
  }

  const result = await getTeam({
    supabase: context.supabase,
    teamId,
    userId: context.user.id,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonNoStore(result.data, result.status);
}

export async function PATCH(request: NextRequest, { params }: Params) {
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

  const { teamId } = await params;
  if (!UUID_PATTERN.test(teamId)) {
    return jsonError("Team id is invalid.", 400);
  }

  if (!isJsonRequest(request)) {
    return jsonError("Content-Type must be application/json.", 415);
  }

  const body = await parseJsonSafely(request);
  if (body === null) {
    return jsonError("Invalid JSON payload.", 400);
  }

  const parsed = teamSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid payload.",
      400,
    );
  }

  const bodyObject =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const hasLockFieldInPayload = Boolean(
    bodyObject &&
      ("lockToken" in bodyObject || "problemStatementId" in bodyObject),
  );

  const lockPayloadParsed = statementLockPatchSchema.safeParse(body);
  if (hasLockFieldInPayload && !lockPayloadParsed.success) {
    return jsonError(
      lockPayloadParsed.error.issues[0]?.message ??
        "Both lock token and problem statement id are required.",
      400,
    );
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

  const result = await patchTeam({
    input: {
      ...(lockPayloadParsed.success ? { lock: lockPayloadParsed.data } : {}),
      team: parsed.data,
    },
    supabase: context.supabase,
    teamId,
    userId: context.user.id,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonNoStore(result.data, result.status);
}

export async function DELETE(request: NextRequest, { params }: Params) {
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

  const { teamId } = await params;
  if (!UUID_PATTERN.test(teamId)) {
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

  const result = await deleteTeam({
    supabase: context.supabase,
    teamId,
    userId: context.user.id,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonNoStore(result.data, result.status);
}
