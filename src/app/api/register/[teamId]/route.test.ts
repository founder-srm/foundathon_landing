import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(),
  getSupabaseCredentials: vi.fn(),
  toTeamRecord: vi.fn(),
  withSrmEmailNetIds: vi.fn(),
}));

vi.mock("@/lib/register-api", () => ({
  createSupabaseClient: mocks.createSupabaseClient,
  EVENT_ID: "event-1",
  getSupabaseCredentials: mocks.getSupabaseCredentials,
  JSON_HEADERS: { "Cache-Control": "no-store" },
  toTeamRecord: mocks.toTeamRecord,
  withSrmEmailNetIds: mocks.withSrmEmailNetIds,
  UUID_PATTERN:
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
}));

const teamId = "11111111-1111-4111-8111-111111111111";

const row = {
  id: teamId,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  details: {},
};

const srmRecord = {
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

const makeParams = (id: string) => ({
  params: Promise.resolve({ teamId: id }),
});

describe("/api/register/[teamId] route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.createSupabaseClient.mockReset();
    mocks.getSupabaseCredentials.mockReset();
    mocks.toTeamRecord.mockReset();
    mocks.withSrmEmailNetIds.mockReset();

    mocks.getSupabaseCredentials.mockReturnValue({
      anonKey: "anon",
      url: "http://localhost",
    });
    mocks.toTeamRecord.mockReturnValue(srmRecord);
    mocks.withSrmEmailNetIds.mockImplementation((payload) => payload);
  });

  it("GET returns team when id exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle,
            }),
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
    const req = new NextRequest(`http://localhost/api/register/${teamId}`);
    const res = await GET(req, makeParams(teamId));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.team.id).toBe(teamId);
  });

  it("PATCH updates team when payload is valid", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const from = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle,
              }),
            }),
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

    const { PATCH } = await import("./route");
    const req = new NextRequest(`http://localhost/api/register/${teamId}`, {
      body: JSON.stringify({
        teamType: "srm",
        teamName: "Updated Team",
        lead: srmRecord.lead,
        members: srmRecord.members,
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    const res = await PATCH(req, makeParams(teamId));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.team.teamName).toBe("Alpha");
  });

  it("DELETE removes team by route param", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: teamId }, error: null });
    const from = vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle,
              }),
            }),
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

    const { DELETE } = await import("./route");
    const req = new NextRequest(`http://localhost/api/register/${teamId}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams(teamId));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
  });

  it("rejects invalid teamId format", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/register/not-a-uuid");

    const res = await GET(req, makeParams("not-a-uuid"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("invalid");
  });
});
