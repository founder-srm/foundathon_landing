import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { EVENT_ID } from "@/lib/register-api";
import { isBlockedLoginEmail } from "@/server/auth/email-policy";
import { createClient } from "@/utils/supabase/server";

export type AuthUiState = {
  isSignedIn: boolean;
  teamId: string | null;
};

export const getAuthUiState = cache(async (): Promise<AuthUiState> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { isSignedIn: false, teamId: null };
  }

  const cookieStore = cookies();
  const supabase = await createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isSignedIn: false, teamId: null };
  }

  if (isBlockedLoginEmail(user.email)) {
    return { isSignedIn: false, teamId: null };
  }

  const { data: team } = await supabase
    .from("eventsregistrations")
    .select("id")
    .eq("event_id", EVENT_ID)
    .eq("application_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    isSignedIn: true,
    teamId: team?.id ?? null,
  };
});
