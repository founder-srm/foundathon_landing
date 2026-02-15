import type { AuthError, Provider } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

type OAuthResponse = {
  error: AuthError | null;
  data: {
    provider: Provider;
    url: string | null;
  } | null;
};

const getSiteUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
};

export async function signInWithOAuth(
  provider: "google",
  nextPath = "/",
): Promise<OAuthResponse> {
  const supabase = createClient();
  const safeNext = nextPath.startsWith("/") ? nextPath : "/";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  return {
    error: error ?? null,
    data: data ?? null,
  };
}
