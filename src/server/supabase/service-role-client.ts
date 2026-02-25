import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleEnv } from "@/server/env";

let cachedClient: SupabaseClient | null = null;
let initialized = false;

export const getServiceRoleSupabaseClient = () => {
  if (initialized) {
    return cachedClient;
  }

  initialized = true;
  const env = getSupabaseServiceRoleEnv();
  if (!env) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
};
