import type { NextRequest } from "next/server";
import { z } from "zod";
import { UUID_PATTERN } from "@/lib/register-api";
import { updateAdminPaymentDecision } from "@/server/admin/payment-proofs";
import { hasAdminReviewAccess } from "@/server/admin/review-access";
import { getRouteAuthContext } from "@/server/auth/context";
import { isJsonRequest, parseJsonSafely } from "@/server/http/request";
import { jsonError, jsonNoStore } from "@/server/http/response";
import { enforceSameOrigin } from "@/server/security/csrf";

const updatePaymentDecisionSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "rejected" && !data.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rejection reason is required.",
        path: ["reason"],
      });
    }
  });

type Params = { params: Promise<{ teamId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const csrfResponse = enforceSameOrigin(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const context = await getRouteAuthContext();
  if (!context.ok) {
    return context.response;
  }

  if (!(await hasAdminReviewAccess(context.user.email))) {
    return jsonError("Forbidden", 403);
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

  const parsed = updatePaymentDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid payload.",
      400,
    );
  }

  const result = await updateAdminPaymentDecision({
    decision: parsed.data.decision,
    reason: parsed.data.reason,
    teamId,
  });
  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonNoStore(result.data, result.status);
}
