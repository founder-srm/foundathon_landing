import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProblemLockToken: vi.fn(),
  createSupabaseClient: vi.fn(),
  enforceIpRateLimit: vi.fn(),
  enforceSameOrigin: vi.fn(),
  enforceUserRateLimit: vi.fn(),
  getProblemStatementById: vi.fn(),
  problemStatementCap: vi.fn(),
  getSupabaseCredentials: vi.fn(),
}));

vi.mock("@/lib/register-api", () => ({
  createSupabaseClient: mocks.createSupabaseClient,
  EVENT_ID: "event-1",
  getSupabaseCredentials: mocks.getSupabaseCredentials,
  JSON_HEADERS: { "Cache-Control": "no-store" },
}));

vi.mock("@/lib/problem-lock-token", () => ({
  createProblemLockToken: mocks.createProblemLockToken,
}));

vi.mock("@/server/security/csrf", () => ({
  enforceSameOrigin: mocks.enforceSameOrigin,
}));

vi.mock("@/server/security/rate-limit", () => ({
  enforceIpRateLimit: mocks.enforceIpRateLimit,
  enforceUserRateLimit: mocks.enforceUserRateLimit,
}));

vi.mock("@/data/problem-statements", () => ({
  getProblemStatementById: mocks.getProblemStatementById,
  PROBLEM_STATEMENT_CAP: mocks.problemStatementCap(),
}));

describe("/api/problem-statements/lock POST", () => {
  beforeEach(() => {
    vi.resetModules();

    mocks.createSupabaseClient.mockReset();
    mocks.enforceIpRateLimit.mockReset();
    mocks.enforceSameOrigin.mockReset();
    mocks.enforceUserRateLimit.mockReset();
    mocks.getProblemStatementById.mockReset();
    mocks.problemStatementCap.mockReset();
    mocks.getSupabaseCredentials.mockReset();
    mocks.createProblemLockToken.mockReset();

    mocks.getSupabaseCredentials.mockReturnValue({
      anonKey: "anon",
      url: "http://localhost",
    });
    mocks.enforceIpRateLimit.mockResolvedValue(null);
    mocks.enforceSameOrigin.mockReturnValue(null);
    mocks.enforceUserRateLimit.mockResolvedValue(null);

    mocks.createProblemLockToken.mockReturnValue({
      expiresAt: "2026-02-20T00:00:00.000Z",
      token: "token-1",
    });
    mocks.problemStatementCap.mockReturnValue(10);
    mocks.getProblemStatementById.mockImplementation((id: string) => {
      if (id !== "ps-01") {
        return null;
      }

      return {
        id: "ps-01",
        summary: "Summary",
        title: "Campus Mobility Optimizer",
      };
    });
  });

  it("rejects unknown problem statement ids", async () => {
    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    });

    const { POST } = await import("./route");
    const request = new NextRequest(
      "http://localhost/api/problem-statements/lock",
      {
        body: JSON.stringify({ problemStatementId: "missing" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("not found");
  });

  it("rejects full problem statements", async () => {
    const fullRows = Array.from({ length: 10 }).map(() => ({
      details: { problemStatementId: "ps-01" },
    }));

    const eqByEvent = vi
      .fn()
      .mockResolvedValue({ data: fullRows, error: null });
    const select = vi.fn().mockReturnValue({ eq: eqByEvent });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ select }),
    });

    const { POST } = await import("./route");
    const request = new NextRequest(
      "http://localhost/api/problem-statements/lock",
      {
        body: JSON.stringify({ problemStatementId: "ps-01" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("This problem statement is currently unavailable.");
  });

  it("rejects over-cap problem statements", async () => {
    const overCapRows = Array.from({ length: 11 }).map(() => ({
      details: { problemStatementId: "ps-01" },
    }));

    const eqByEvent = vi
      .fn()
      .mockResolvedValue({ data: overCapRows, error: null });
    const select = vi.fn().mockReturnValue({ eq: eqByEvent });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ select }),
    });

    const { POST } = await import("./route");
    const request = new NextRequest(
      "http://localhost/api/problem-statements/lock",
      {
        body: JSON.stringify({ problemStatementId: "ps-01" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("This problem statement is currently unavailable.");
  });

  it("returns 500 when lock token generation fails", async () => {
    const eqByEvent = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ eq: eqByEvent });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ select }),
    });

    mocks.createProblemLockToken.mockImplementation(() => {
      throw new Error("token failed");
    });

    const { POST } = await import("./route");
    const request = new NextRequest(
      "http://localhost/api/problem-statements/lock",
      {
        body: JSON.stringify({ problemStatementId: "ps-01" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("token failed");
  });

  it("returns lock token for valid requests", async () => {
    const eqByEvent = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ eq: eqByEvent });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ select }),
    });

    const { POST } = await import("./route");
    const request = new NextRequest(
      "http://localhost/api/problem-statements/lock",
      {
        body: JSON.stringify({ problemStatementId: "ps-01" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.locked).toBe(true);
    expect(body.problemStatement.id).toBe("ps-01");
    expect(body.lockToken).toBe("token-1");
    expect(body.lockExpiresAt).toBe("2026-02-20T00:00:00.000Z");
    expect(mocks.createProblemLockToken).toHaveBeenCalledWith({
      problemStatementId: "ps-01",
      userId: "user-1",
    });
  });

  it("returns 403 when CSRF validation fails", async () => {
    mocks.enforceSameOrigin.mockReturnValue(
      new Response(JSON.stringify({ code: "CSRF_FAILED" }), {
        headers: { "content-type": "application/json" },
        status: 403,
      }),
    );

    const { POST } = await import("./route");
    const request = new NextRequest(
      "http://localhost/api/problem-statements/lock",
      {
        body: JSON.stringify({ problemStatementId: "ps-01" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("CSRF_FAILED");
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns 429 when request is rate limited by IP", async () => {
    mocks.enforceIpRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ code: "RATE_LIMITED" }), {
        headers: { "content-type": "application/json" },
        status: 429,
      }),
    );

    const { POST } = await import("./route");
    const request = new NextRequest(
      "http://localhost/api/problem-statements/lock",
      {
        body: JSON.stringify({ problemStatementId: "ps-01" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });
});
