import { NextResponse } from "next/server";
import { resolveRootRedirect, signOutCurrentUser } from "@/server/auth/oauth";
import { enforceSameOrigin } from "@/server/security/csrf";

export async function POST(request: Request) {
  const csrfResponse = enforceSameOrigin(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  await signOutCurrentUser();
  return NextResponse.redirect(resolveRootRedirect(request), { status: 303 });
}
