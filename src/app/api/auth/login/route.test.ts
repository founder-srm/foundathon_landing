import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  beginGoogleOAuthLogin: vi.fn(),
  enforceIpRateLimit: vi.fn(),
}));

vi.mock("@/server/auth/oauth", () => ({
  beginGoogleOAuthLogin: mocks.beginGoogleOAuthLogin,
}));

vi.mock("@/server/security/rate-limit", () => ({
  enforceIpRateLimit: mocks.enforceIpRateLimit,
}));

describe("/api/auth/login GET", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.beginGoogleOAuthLogin.mockReset();
    mocks.enforceIpRateLimit.mockReset();
    mocks.enforceIpRateLimit.mockResolvedValue(null);
  });

  it("returns 500 when Supabase env is missing", async () => {
    mocks.beginGoogleOAuthLogin.mockResolvedValue({
      error: "Supabase environment variables are not configured.",
      ok: false,
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/auth/login"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(
      "Supabase environment variables are not configured.",
    );
  });

  it("returns 500 when OAuth provider call fails", async () => {
    mocks.beginGoogleOAuthLogin.mockResolvedValue({
      error: "oauth failed",
      ok: false,
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/auth/login"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("oauth failed");
  });

  it("redirects to the provider URL on success", async () => {
    mocks.beginGoogleOAuthLogin.mockResolvedValue({
      ok: true,
      url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=abc",
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/auth/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=abc",
    );
  });

  it("returns 429 when request is rate limited", async () => {
    mocks.enforceIpRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ code: "RATE_LIMITED" }), {
        headers: { "content-type": "application/json" },
        status: 429,
      }),
    );

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/auth/login"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(mocks.beginGoogleOAuthLogin).not.toHaveBeenCalled();
  });
});
