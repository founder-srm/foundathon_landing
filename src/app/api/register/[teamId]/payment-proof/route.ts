import { type NextRequest, NextResponse } from "next/server";
import { UUID_PATTERN } from "@/lib/register-api";
import { getRouteAuthContext } from "@/server/auth/context";
import { jsonError } from "@/server/http/response";
import {
  getTeamPaymentProofDownloadUrl,
  submitTeamPaymentProof,
} from "@/server/registration/payment-proofs";
import { enforceSameOrigin } from "@/server/security/csrf";
import {
  enforceIpRateLimit,
  enforceUserRateLimit,
} from "@/server/security/rate-limit";

type Params = { params: Promise<{ teamId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const ipRateLimitResponse = await enforceIpRateLimit({
    policy: "payment_proof_view_ip",
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
    policy: "payment_proof_view_user",
    request,
    userId: context.user.id,
  });
  if (userRateLimitResponse) {
    return userRateLimitResponse;
  }

  const result = await getTeamPaymentProofDownloadUrl({
    supabase: context.supabase,
    teamId,
    userId: context.user.id,
  });
  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  const response = NextResponse.redirect(result.data.url, { status: 302 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest, { params }: Params) {
  const csrfResponse = enforceSameOrigin(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const ipRateLimitResponse = await enforceIpRateLimit({
    policy: "payment_proof_upload_ip",
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
    policy: "payment_proof_upload_user",
    request,
    userId: context.user.id,
  });
  if (userRateLimitResponse) {
    return userRateLimitResponse;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data payload.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("Payment proof file is required.", 400);
  }

  const utr = formData.get("utr");
  if (typeof utr !== "string") {
    return jsonError("Transaction ID / UTR is required.", 400);
  }

  const result = await submitTeamPaymentProof({
    input: { file, teamId, utr },
    supabase: context.supabase,
    userId: context.user.id,
  });
  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "no-store" },
    status: result.status,
  });
}
