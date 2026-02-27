import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EVENT_ID, EVENT_TITLE } from "@/server/registration/constants";

const mocks = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(),
  enforceIpRateLimit: vi.fn(),
  enforceSameOrigin: vi.fn(),
  enforceUserRateLimit: vi.fn(),
  getProblemStatementById: vi.fn(),
  problemStatementCap: vi.fn(),
  getSupabaseCredentials: vi.fn(),
  toTeamSummary: vi.fn(),
  verifyProblemLockToken: vi.fn(),
  withSrmEmailNetIds: vi.fn(),
}));

vi.mock("@/lib/register-api", () => ({
  createSupabaseClient: mocks.createSupabaseClient,
  EVENT_ID: "583a3b40-da9d-412a-a266-cc7e64330b16",
  EVENT_TITLE: "Foundathon 3.0",
  getSupabaseCredentials: mocks.getSupabaseCredentials,
  JSON_HEADERS: { "Cache-Control": "no-store" },
  toTeamSummary: mocks.toTeamSummary,
  UUID_PATTERN:
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  withSrmEmailNetIds: mocks.withSrmEmailNetIds,
}));

vi.mock("@/lib/problem-lock-token", () => ({
  verifyProblemLockToken: mocks.verifyProblemLockToken,
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

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-01-01T00:00:00.000Z",
  details: {},
  updated_at: "2026-01-01T00:00:00.000Z",
};

const summary = {
  createdAt: row.created_at,
  id: row.id,
  leadName: "Lead",
  memberCount: 3,
  teamName: "Alpha",
  teamType: "srm" as const,
  updatedAt: row.updated_at,
};

const teamPayload = {
  teamType: "srm",
  teamName: "Board Breakers",
  lead: {
    name: "Lead",
    raNumber: "RA0000000000001",
    netId: "od7270",
    dept: "CSE",
    contact: 9876543210,
  },
  members: [
    {
      name: "M1",
      raNumber: "RA0000000000002",
      netId: "ab1234",
      dept: "CSE",
      contact: 9876543211,
    },
    {
      name: "M2",
      raNumber: "RA0000000000003",
      netId: "cd5678",
      dept: "ECE",
      contact: 9876543212,
    },
  ],
} as const;

const makeAuthClient = ({
  from,
  user,
}: {
  from?: ReturnType<typeof vi.fn>;
  user?: { email?: string; id: string } | null;
}) => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: user ?? { email: "lead@example.com", id: "user-1" } },
      error: null,
    }),
  },
  from: from ?? vi.fn(),
});

describe("/api/register route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.createSupabaseClient.mockReset();
    mocks.enforceIpRateLimit.mockReset();
    mocks.enforceSameOrigin.mockReset();
    mocks.enforceUserRateLimit.mockReset();
    mocks.getProblemStatementById.mockReset();
    mocks.problemStatementCap.mockReset();
    mocks.getSupabaseCredentials.mockReset();
    mocks.toTeamSummary.mockReset();
    mocks.verifyProblemLockToken.mockReset();
    mocks.withSrmEmailNetIds.mockReset();

    mocks.getSupabaseCredentials.mockReturnValue({
      anonKey: "anon",
      url: "http://localhost",
    });
    mocks.enforceIpRateLimit.mockResolvedValue(null);
    mocks.enforceSameOrigin.mockReturnValue(null);
    mocks.enforceUserRateLimit.mockResolvedValue(null);
    mocks.toTeamSummary.mockReturnValue(summary);
    mocks.withSrmEmailNetIds.mockImplementation((payload) => payload);
    mocks.verifyProblemLockToken.mockReturnValue({
      payload: { iat: Date.parse("2026-02-19T08:00:00.000Z") },
      valid: true,
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

  it("GET returns 401 for unauthenticated users", async () => {
    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(),
    });

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("GET returns summarized teams", async () => {
    const order = vi.fn().mockResolvedValue({ data: [row], error: null });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ order }),
        }),
      }),
    });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from,
    });

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.teams).toEqual([summary]);
    expect(mocks.toTeamSummary).toHaveBeenCalledWith(row);
  });

  it("POST rejects invalid payload", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({ team: { teamType: "srm" } }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it("POST returns 403 when CSRF validation fails", async () => {
    mocks.enforceSameOrigin.mockReturnValue(
      new Response(JSON.stringify({ code: "CSRF_FAILED" }), {
        headers: { "content-type": "application/json" },
        status: 403,
      }),
    );

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("CSRF_FAILED");
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it("POST returns 429 when IP rate limit is exceeded", async () => {
    mocks.enforceIpRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ code: "RATE_LIMITED" }), {
        headers: { "content-type": "application/json" },
        status: 429,
      }),
    );

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it("POST rejects non-JSON content types", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: "lockToken=token-1",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(415);
    expect(body.error).toContain("Content-Type must be application/json");
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it("POST rejects malformed JSON", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: "{bad-json",
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid JSON payload");
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it("POST returns 401 for unauthenticated users", async () => {
    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(),
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("POST rejects unknown problem statements", async () => {
    const from = vi.fn();
    mocks.createSupabaseClient.mockResolvedValue(
      makeAuthClient({
        from,
      }),
    );

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-99",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Problem statement not found.");
    expect(from).not.toHaveBeenCalled();
  });

  it("POST rejects invalid lock tokens", async () => {
    mocks.verifyProblemLockToken.mockReturnValue({
      error: "Lock token is malformed.",
      valid: false,
    });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "lead@example.com", id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "bad",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("malformed");
  });

  it("POST creates team with direct insert for valid input", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });

    const countEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const countSelect = vi.fn().mockReturnValue({ eq: countEq });

    const single = vi.fn().mockResolvedValue({
      data: { id: "22222222-2222-4222-8222-222222222222" },
      error: null,
    });
    const selectInserted = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectInserted });

    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ insert });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "lead@example.com", id: "user-1" } },
          error: null,
        }),
      },
      from,
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.team.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(mocks.verifyProblemLockToken).toHaveBeenCalledWith({
      problemStatementId: "ps-01",
      token: "token-1",
      userId: "user-1",
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const insertedRecord = insert.mock.calls[0][0][0];
    expect(insertedRecord.event_id).toBe(EVENT_ID);
    expect(insertedRecord.event_title).toBe(EVENT_TITLE);
    expect(insertedRecord.application_id).toBe("user-1");
    expect(insertedRecord.registration_email).toBe("lead@example.com");
    expect(insertedRecord.details.problemStatementId).toBe("ps-01");
    expect(insertedRecord.details.problemStatementTitle).toBe(
      "Campus Mobility Optimizer",
    );
  });

  it("POST calls withSrmEmailNetIds before insert", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });

    const countEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const countSelect = vi.fn().mockReturnValue({ eq: countEq });

    const single = vi.fn().mockResolvedValue({
      data: { id: "22222222-2222-4222-8222-222222222222" },
      error: null,
    });
    const selectInserted = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectInserted });

    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ insert });

    mocks.createSupabaseClient.mockResolvedValue(
      makeAuthClient({
        from,
      }),
    );

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mocks.withSrmEmailNetIds).toHaveBeenCalledWith(teamPayload);
  });

  it("POST stores empty registration email when auth user email is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });

    const countEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const countSelect = vi.fn().mockReturnValue({ eq: countEq });

    const single = vi.fn().mockResolvedValue({
      data: { id: "22222222-2222-4222-8222-222222222222" },
      error: null,
    });
    const selectInserted = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectInserted });

    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ insert });

    mocks.createSupabaseClient.mockResolvedValue(
      makeAuthClient({
        from,
        user: { id: "user-1" },
      }),
    );

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const insertedRecord = insert.mock.calls[0][0][0];
    expect(insertedRecord.registration_email).toBe("");
  });

  it("POST returns 409 when user already has a registration", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "existing-team-id" },
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });

    const insert = vi.fn();
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ insert });

    mocks.createSupabaseClient.mockResolvedValue(
      makeAuthClient({
        from,
      }),
    );

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("You have already registered for this event.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("POST returns 500 when existing-registration lookup fails", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });

    const from = vi.fn().mockReturnValueOnce({ select: existingSelect });

    mocks.createSupabaseClient.mockResolvedValue(
      makeAuthClient({
        from,
      }),
    );

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to validate existing registrations.");
  });

  it("POST returns 500 when statement availability check fails", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });

    const countEq = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "db error" },
    });
    const countSelect = vi.fn().mockReturnValue({ eq: countEq });

    const insert = vi.fn();
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ insert });

    mocks.createSupabaseClient.mockResolvedValue(
      makeAuthClient({
        from,
      }),
    );

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to check statement availability.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("POST returns 500 when insert fails", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });

    const countEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const countSelect = vi.fn().mockReturnValue({ eq: countEq });

    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "insert failed" },
    });
    const selectInserted = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectInserted });

    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ insert });

    mocks.createSupabaseClient.mockResolvedValue(
      makeAuthClient({
        from,
      }),
    );

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("insert failed");
  });

  it("POST returns 500 when insert returns an invalid team id", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });

    const countEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const countSelect = vi.fn().mockReturnValue({ eq: countEq });

    const single = vi.fn().mockResolvedValue({
      data: { id: "not-a-uuid" },
      error: null,
    });
    const selectInserted = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectInserted });

    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ insert });

    mocks.createSupabaseClient.mockResolvedValue(
      makeAuthClient({
        from,
      }),
    );

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to create registration.");
  });

  it("POST returns 409 when statement cap is already reached", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });

    const fullRows = Array.from({ length: 10 }).map(() => ({
      details: { problemStatementId: "ps-01" },
    }));
    const countEq = vi.fn().mockResolvedValue({ data: fullRows, error: null });
    const countSelect = vi.fn().mockReturnValue({ eq: countEq });

    const insert = vi.fn();
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ insert });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "lead@example.com", id: "user-1" } },
          error: null,
        }),
      },
      from,
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("This problem statement is currently unavailable.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("POST returns 409 when more than 10 teams already joined a statement", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });

    const overCapRows = Array.from({ length: 11 }).map(() => ({
      details: { problemStatementId: "ps-01" },
    }));
    const countEq = vi
      .fn()
      .mockResolvedValue({ data: overCapRows, error: null });
    const countSelect = vi.fn().mockReturnValue({ eq: countEq });

    const insert = vi.fn();
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ insert });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "lead@example.com", id: "user-1" } },
          error: null,
        }),
      },
      from,
    });

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/register", {
      body: JSON.stringify({
        lockToken: "token-1",
        problemStatementId: "ps-01",
        team: teamPayload,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("This problem statement is currently unavailable.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("DELETE rejects invalid id format", async () => {
    const { DELETE } = await import("./route");
    const req = new NextRequest("http://localhost/api/register?id=not-a-uuid", {
      method: "DELETE",
    });

    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("invalid");
  });
});
