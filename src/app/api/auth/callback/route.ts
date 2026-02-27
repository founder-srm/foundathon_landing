import { type NextRequest, NextResponse } from "next/server";
import { resolveAuthCallbackRedirect } from "@/server/auth/oauth";
import { enforceIpRateLimit } from "@/server/security/rate-limit";

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceIpRateLimit({
    policy: "auth_callback_ip",
    request,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const redirectTo = await resolveAuthCallbackRedirect(request);
  return NextResponse.redirect(redirectTo);
}
