import type { User } from "@supabase/supabase-js";
import {
  createSupabaseClient,
  getSupabaseCredentials,
} from "@/lib/register-api";
import { isBlockedLoginEmail } from "@/server/auth/email-policy";
import { jsonError } from "@/server/http/response";

type RouteSupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;

type MissingConfigContext = {
  ok: false;
  response: ReturnType<typeof jsonError>;
};

type UnauthenticatedContext = {
  ok: false;
  response: ReturnType<typeof jsonError>;
};

type AuthenticatedContext = {
  ok: true;
  supabase: RouteSupabaseClient;
  user: User;
};

export type RouteAuthContext =
  | MissingConfigContext
  | UnauthenticatedContext
  | AuthenticatedContext;

export const missingSupabaseConfigResponse = () =>
  jsonError("Supabase environment variables are not configured.", 500);

export const unauthorizedResponse = () => jsonError("Unauthorized", 401);

export const getRouteAuthContext = async (): Promise<RouteAuthContext> => {
  const credentials = getSupabaseCredentials();
  if (!credentials) {
    return {
      ok: false,
      response: missingSupabaseConfigResponse(),
    };
  }

  const supabase = await createSupabaseClient(credentials);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: unauthorizedResponse(),
    };
  }

  if (isBlockedLoginEmail(user.email)) {
    await supabase.auth.signOut();
    return {
      ok: false,
      response: unauthorizedResponse(),
    };
  }

  return {
    ok: true,
    supabase,
    user,
  };
};
