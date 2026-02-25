import { afterEach, describe, expect, it } from "vitest";
import {
  getFoundathonNodeEnv,
  getFoundathonSiteUrl,
  getProblemLockTokenSecret,
  getSupabaseEnv,
  isFoundathonDevelopment,
} from "@/server/env";

const ENV_KEYS = [
  "FOUNDATHON_NEXT_PUBLIC_SITE_URL",
  "FOUNDATHON_NODE_ENV",
  "FOUNDATHON_PROBLEM_LOCK_TOKEN_SECRET",
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
});
