import { afterEach, describe, expect, it } from "vitest";
import {
  getAllowedRedirectHosts,
  getFoundathonNodeEnv,
  getFoundathonSiteUrl,
  getFoundathonStatsApiKey,
  getFoundathonStatsExcludedEmails,
  getFoundathonStatsPageKey,
  getProblemLockTokenSecret,
  getSupabaseEnv,
  isFoundathonDevelopment,
} from "@/server/env";

const ENV_KEYS = [
  "FOUNDATHON_ALLOWED_REDIRECT_HOSTS",
  "FOUNDATHON_NEXT_PUBLIC_SITE_URL",
  "FOUNDATHON_NODE_ENV",
  "FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET",
  "FOUNDATHON_STATS_API_KEY",
  "FOUNDATHON_STATS_EXCLUDED_EMAILS",
  "FOUNDATHON_STATS_PAGE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

const restoreEnv = () => {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
};

afterEach(() => {
  restoreEnv();
});

describe("server/env", () => {
  it("returns null for missing Supabase required values", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(getSupabaseEnv()).toBeNull();
  });

  it("returns Supabase credentials when required values are present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    expect(getSupabaseEnv()).toEqual({
      anonKey: "anon-key",
      url: "https://supabase.example",
    });
  });

  it("detects development env", () => {
    process.env.FOUNDATHON_NODE_ENV = "development";

    expect(getFoundathonNodeEnv()).toBe("development");
    expect(isFoundathonDevelopment()).toBe(true);
  });

  it("returns optional site URL and required token", () => {
    process.env.FOUNDATHON_NEXT_PUBLIC_SITE_URL = "https://foundathon.example";
    process.env.FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET = "lock-secret";

    expect(getFoundathonSiteUrl()).toBe("https://foundathon.example");
    expect(getProblemLockTokenSecret()).toBe("lock-secret");
  });

  it("returns null for empty required values", () => {
    process.env.FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET = "   ";

    expect(getProblemLockTokenSecret()).toBeNull();
  });

  it("returns null for missing stats API key", () => {
    delete process.env.FOUNDATHON_STATS_API_KEY;

    expect(getFoundathonStatsApiKey()).toBeNull();
  });

  it("returns stats API key when configured", () => {
    process.env.FOUNDATHON_STATS_API_KEY = "stats-secret";

    expect(getFoundathonStatsApiKey()).toBe("stats-secret");
  });

  it("returns null for missing stats page key", () => {
    delete process.env.FOUNDATHON_STATS_PAGE_KEY;

    expect(getFoundathonStatsPageKey()).toBeNull();
  });

  it("returns stats page key when configured", () => {
    process.env.FOUNDATHON_STATS_PAGE_KEY = "page-secret";

    expect(getFoundathonStatsPageKey()).toBe("page-secret");
  });

  it("parses allowed redirect hosts", () => {
    process.env.FOUNDATHON_ALLOWED_REDIRECT_HOSTS =
      " foundathon.example, localhost:3000 ,  ";

    expect(getAllowedRedirectHosts()).toEqual([
      "foundathon.example",
      "localhost:3000",
    ]);
  });

  it("returns default stats excluded email when env is missing", () => {
    delete process.env.FOUNDATHON_STATS_EXCLUDED_EMAILS;

    expect(getFoundathonStatsExcludedEmails()).toEqual([
      "opdhaker2007@gmail.com",
    ]);
  });

  it("merges and normalizes stats excluded emails", () => {
    process.env.FOUNDATHON_STATS_EXCLUDED_EMAILS =
      " Test@Example.com, opdhaker2007@gmail.com, second@example.com ";

    expect(getFoundathonStatsExcludedEmails()).toEqual([
      "opdhaker2007@gmail.com",
      "test@example.com",
      "second@example.com",
    ]);
  });
});
