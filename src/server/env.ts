type EnvKey =
  | "FOUNDATHON_ALLOWED_REDIRECT_HOSTS"
  | "FOUNDATHON_NEXT_PUBLIC_SITE_URL"
  | "FOUNDATHON_NODE_ENV"
  | "FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET"
  | "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
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

export type SupabaseServiceRoleEnv = {
  serviceRoleKey: string;
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

export const getSupabaseServiceRoleEnv = (): SupabaseServiceRoleEnv | null => {
  const url = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey =
    readRequiredEnv("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE") ??
    readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { serviceRoleKey, url };
};

export const getFoundathonNodeEnv = () =>
  readOptionalEnv("FOUNDATHON_NODE_ENV");

export const isFoundathonDevelopment = () =>
  getFoundathonNodeEnv() === "development";

export const getFoundathonSiteUrl = () =>
  readOptionalEnv("FOUNDATHON_NEXT_PUBLIC_SITE_URL");

export const getProblemLockTokenSecret = () =>
  readRequiredEnv("FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET");

export const getAllowedRedirectHosts = () => {
  const raw = readOptionalEnv("FOUNDATHON_ALLOWED_REDIRECT_HOSTS");
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
};
