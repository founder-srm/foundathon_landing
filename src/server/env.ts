type EnvKey =
  | "FOUNDATHON_NEXT_PUBLIC_SITE_URL"
  | "FOUNDATHON_NODE_ENV"
  | "FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_SUPABASE_URL";

const readOptionalEnv = (key: EnvKey) => {
  const value = process.env[key];
  return typeof value === "string" ? value : undefined;
};

const readRequiredEnv = (key: EnvKey) => {
  const value = readOptionalEnv(key);
  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
};

export type SupabaseEnv = {
  anonKey: string;
  url: string;
};

export const getSupabaseEnv = (): SupabaseEnv | null => {
  const url = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    return null;
  }

  return { anonKey, url };
};

export const getFoundathonNodeEnv = () =>
  readOptionalEnv("FOUNDATHON_NODE_ENV");

export const isFoundathonDevelopment = () =>
  getFoundathonNodeEnv() === "development";

export const getFoundathonSiteUrl = () =>
  readOptionalEnv("FOUNDATHON_NEXT_PUBLIC_SITE_URL");

export const getProblemLockTokenSecret = () =>
  readRequiredEnv("FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET");
