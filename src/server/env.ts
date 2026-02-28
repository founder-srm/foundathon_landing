type EnvKey =
  | "FOUNDATHON_ALLOWED_REDIRECT_HOSTS"
  | "FOUNDATHON_NEXT_PUBLIC_SITE_URL"
  | "FOUNDATHON_NODE_ENV"
  | "FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET"
  | "FOUNDATHON_STATS_API_KEY"
  | "FOUNDATHON_STATS_EXCLUDED_EMAILS"
  | "FOUNDATHON_STATS_PAGE_KEY"
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

export const getFoundathonStatsApiKey = () =>
  readRequiredEnv("FOUNDATHON_STATS_API_KEY");

export const getFoundathonStatsPageKey = () =>
  readRequiredEnv("FOUNDATHON_STATS_PAGE_KEY");

const DEFAULT_STATS_EXCLUDED_EMAILS = ["opdhaker2007@gmail.com"];

export const getFoundathonStatsExcludedEmails = () => {
  const raw = readOptionalEnv("FOUNDATHON_STATS_EXCLUDED_EMAILS");
  const emails = [
    ...DEFAULT_STATS_EXCLUDED_EMAILS,
    ...(raw ? raw.split(",") : []),
  ]
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

  return [...new Set(emails)];
};
