import { cookies } from "next/headers";
import {
  AUTH_ERROR_REASON_SRM_BLOCKED,
  isBlockedLoginEmail,
} from "@/server/auth/email-policy";
import { getFoundathonSiteUrl, isFoundathonDevelopment } from "@/server/env";
import {
  createRouteSupabaseClient,
  getRouteSupabaseCredentials,
} from "@/server/supabase/route-client";
import { createClient } from "@/utils/supabase/server";

type BeginOAuthSuccess = {
  ok: true;
  url: string;
};

type BeginOAuthFailure = {
  error: string;
  ok: false;
};

export type BeginOAuthResult = BeginOAuthSuccess | BeginOAuthFailure;

const resolveLoginBaseUrl = () =>
  isFoundathonDevelopment() ? "http://localhost:3000" : getFoundathonSiteUrl();

export const beginGoogleOAuthLogin = async (): Promise<BeginOAuthResult> => {
  const credentials = getRouteSupabaseCredentials();
  if (!credentials) {
    return {
      error: "Supabase environment variables are not configured.",
      ok: false,
    };
  }

  const supabase = await createRouteSupabaseClient(credentials);
  const url = resolveLoginBaseUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${url}/api/auth/callback`,
    },
  });

  if (error) {
    return {
      error: error.message,
      ok: false,
    };
  }

  return {
    ok: true,
    url: data.url,
  };
};

const toSafeNextPath = (nextParam: string | null) => {
  const isSafeNext = !!nextParam && /^\/[a-zA-Z0-9_/-]*$/.test(nextParam);
  return isSafeNext ? (nextParam as string) : "/";
};

const resolveAuthErrorRedirect = (origin: string, reason?: string) => {
  const errorUrl = new URL("/auth/auth-code-error", origin);
  if (reason) {
    errorUrl.searchParams.set("reason", reason);
  }

  return errorUrl.toString();
};

export const resolveAuthCallbackRedirect = async (request: Request) => {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = toSafeNextPath(searchParams.get("next"));

  if (code) {
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (isBlockedLoginEmail(data.user.email)) {
        await supabase.auth.signOut();
        return resolveAuthErrorRedirect(origin, AUTH_ERROR_REASON_SRM_BLOCKED);
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      if (isFoundathonDevelopment()) {
        return `${origin}${next}`;
      }

      if (forwardedHost) {
        return `https://${forwardedHost}${next}`;
      }

      return `${origin}${next}`;
    }
  }

  return resolveAuthErrorRedirect(origin);
};

export const signOutCurrentUser = async () => {
  const cookieStore = cookies();
  const supabase = await createClient(cookieStore);
  await supabase.auth.signOut();
};

export const resolveRootRedirect = (request: Request) => {
  const { origin } = new URL(request.url);
  return `${origin}/`;
};
