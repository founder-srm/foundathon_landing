import { type NextRequest, NextResponse } from "next/server";
import { UUID_PATTERN } from "@/lib/register-api";
import { getAdminPaymentProofDownloadUrl } from "@/server/admin/payment-proofs";
import { hasAdminReviewAccess } from "@/server/admin/review-access";
import { getRouteAuthContext } from "@/server/auth/context";
import { jsonError } from "@/server/http/response";
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

  const context = await getRouteAuthContext();
  if (!context.ok) {
    return context.response;
  }

  if (!(await hasAdminReviewAccess(context.user.email))) {
    return jsonError("Forbidden", 403);
  }

  const userRateLimitResponse = await enforceUserRateLimit({
    policy: "payment_proof_view_user",
    request,
    userId: context.user.id,
  });
  if (userRateLimitResponse) {
    return userRateLimitResponse;
  }

  const { teamId } = await params;
  if (!UUID_PATTERN.test(teamId)) {
    return jsonError("Team id is invalid.", 400);
  }

  const result = await getAdminPaymentProofDownloadUrl({ teamId });
  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  const response = NextResponse.redirect(result.data.url, { status: 302 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
