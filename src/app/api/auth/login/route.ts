import { type NextRequest, NextResponse } from "next/server";
import { beginGoogleOAuthLogin } from "@/server/auth/oauth";
import { enforceIpRateLimit } from "@/server/security/rate-limit";

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceIpRateLimit({
    policy: "auth_login_ip",
    request,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const result = await beginGoogleOAuthLogin();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.redirect(result.url);
}
