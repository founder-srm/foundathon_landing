import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(),
  getSupabaseCredentials: vi.fn(),
  toTeamRecord: vi.fn(),
  toTeamSummary: vi.fn(),
  transformToLegacyFormat: vi.fn(),
  withSrmEmailNetIds: vi.fn(),
}));

vi.mock("@/lib/register-api", () => ({
  createSupabaseClient: mocks.createSupabaseClient,
  EVENT_ID: "event-1",
  getSupabaseCredentials: mocks.getSupabaseCredentials,
  JSON_HEADERS: { "Cache-Control": "no-store" },
  toTeamRecord: mocks.toTeamRecord,
  toTeamSummary: mocks.toTeamSummary,
  transformToLegacyFormat: mocks.transformToLegacyFormat,
  withSrmEmailNetIds: mocks.withSrmEmailNetIds,
  UUID_PATTERN:
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
}));

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  details: {},
};

const summary = {
  id: row.id,
  teamName: "Alpha",
  teamType: "srm" as const,
  leadName: "Lead",
  memberCount: 3,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};

const teamRecord = {
  id: row.id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  teamType: "srm" as const,
  teamName: "Alpha",
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
};

describe("/api/register route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.createSupabaseClient.mockReset();
    mocks.getSupabaseCredentials.mockReset();
    mocks.toTeamRecord.mockReset();
    mocks.toTeamSummary.mockReset();
    mocks.transformToLegacyFormat.mockReset();
    mocks.withSrmEmailNetIds.mockReset();

    mocks.getSupabaseCredentials.mockReturnValue({
      anonKey: "anon",
      url: "http://localhost",
    });
    mocks.toTeamSummary.mockReturnValue(summary);
    mocks.toTeamRecord.mockReturnValue(teamRecord);
    mocks.transformToLegacyFormat.mockImplementation((payload) => ({
      payload,
    }));
    mocks.withSrmEmailNetIds.mockImplementation((payload) => payload);
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
          eq: vi.fn().mockReturnValue({
            order,
          }),
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
      body: JSON.stringify({ teamType: "srm" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it("POST accepts valid payload and returns created team", async () => {
    const existingCheck = vi
      .fn()
      .mockResolvedValue({ data: null, error: null });
    const createRecord = vi.fn().mockResolvedValue({ data: row, error: null });

    const from = vi
      .fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: existingCheck,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: createRecord,
          }),
        }),
      });

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
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.team.id).toBe(row.id);
    expect(body.teams).toEqual([summary]);
    expect(mocks.transformToLegacyFormat).toHaveBeenCalledTimes(1);
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
