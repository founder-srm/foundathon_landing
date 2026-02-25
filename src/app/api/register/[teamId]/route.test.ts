import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(),
  getProblemStatementById: vi.fn(),
  problemStatementCap: vi.fn(),
  getSupabaseCredentials: vi.fn(),
  toTeamRecord: vi.fn(),
  verifyProblemLockToken: vi.fn(),
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

vi.mock("@/lib/problem-lock-token", () => ({
  verifyProblemLockToken: mocks.verifyProblemLockToken,
}));

vi.mock("@/data/problem-statements", () => ({
  getProblemStatementById: mocks.getProblemStatementById,
  PROBLEM_STATEMENT_CAP: mocks.problemStatementCap(),
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

const nonSrmRecord = {
  id: row.id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  teamType: "non_srm" as const,
  teamName: "Beta",
  collegeName: "Some College",
  isClub: true,
  clubName: "Tech Club",
  lead: {
    name: "Lead Non SRM",
    collegeId: "NCOL001",
    collegeEmail: "lead@example.edu",
    contact: 9876543210,
  },
  members: [
    {
      name: "Member A",
      collegeId: "NCOL002",
      collegeEmail: "a@example.edu",
      contact: 9876543211,
    },
    {
      name: "Member B",
      collegeId: "NCOL003",
      collegeEmail: "b@example.edu",
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
    mocks.getProblemStatementById.mockReset();
    mocks.problemStatementCap.mockReset();
    mocks.getSupabaseCredentials.mockReset();
    mocks.toTeamRecord.mockReset();
    mocks.verifyProblemLockToken.mockReset();
    mocks.withSrmEmailNetIds.mockReset();

    mocks.getSupabaseCredentials.mockReturnValue({
      anonKey: "anon",
      url: "http://localhost",
    });
    mocks.toTeamRecord.mockReturnValue(srmRecord);
    mocks.problemStatementCap.mockReturnValue(10);
    mocks.getProblemStatementById.mockReturnValue({
      id: "ps-01",
      summary: "Summary",
      title: "Campus Mobility Optimizer",
    });
    mocks.verifyProblemLockToken.mockReturnValue({
      payload: { iat: Date.parse("2026-02-19T08:00:00.000Z") },
      valid: true,
    });
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

  it("GET clears stale presentation metadata when storage object is missing", async () => {
    const stalePresentationRow = {
      ...row,
      details: {
        ...row.details,
        presentationFileName: "team-deck.pptx",
        presentationFileSizeBytes: 1024,
        presentationMimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        presentationPublicUrl: "https://example.com/public/team-deck.pptx",
        presentationStoragePath: "registrations/team-id/submission.pptx",
        presentationUploadedAt: "2026-02-20T08:00:00.000Z",
      },
    };

    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: stalePresentationRow,
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...row,
        details: {},
      },
      error: null,
    });
    const updateRecord = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle,
            }),
          }),
        }),
      }),
    });
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ update: updateRecord });

    const list = vi.fn().mockResolvedValue({ data: [], error: null });
    const storageFrom = vi.fn().mockReturnValue({ list });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from,
      storage: {
        from: storageFrom,
      },
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 404 }));

    try {
      const { GET } = await import("./route");
      const req = new NextRequest(`http://localhost/api/register/${teamId}`);
      const res = await GET(req, makeParams(teamId));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.team.id).toBe(teamId);
      expect(storageFrom).toHaveBeenCalledWith("foundathon-presentation");
      expect(list).toHaveBeenCalledWith("registrations/team-id", {
        limit: 100,
      });
      const updatePayload = updateRecord.mock.calls[0]?.[0];
      expect(updatePayload).toBeDefined();
      expect(updatePayload.details.presentationPublicUrl).toBeUndefined();
      expect(updatePayload.details.presentationStoragePath).toBeUndefined();
      expect(updatePayload.details.presentationUploadedAt).toBeUndefined();
      expect(updatePayload.details.presentationFileName).toBeUndefined();
      expect(updatePayload.details.presentationMimeType).toBeUndefined();
      expect(updatePayload.details.presentationFileSizeBytes).toBeUndefined();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("GET keeps presentation metadata when storage list is empty but public file is reachable", async () => {
    const stalePresentationRow = {
      ...row,
      details: {
        ...row.details,
        presentationFileName: "team-deck.pptx",
        presentationFileSizeBytes: 1024,
        presentationMimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        presentationPublicUrl: "https://example.com/public/team-deck.pptx",
        presentationStoragePath: "registrations/team-id/submission.pptx",
        presentationUploadedAt: "2026-02-20T08:00:00.000Z",
      },
    };

    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: stalePresentationRow,
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: stalePresentationRow,
      error: null,
    });
    const updateRecord = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle,
            }),
          }),
        }),
      }),
    });
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ update: updateRecord });

    const list = vi.fn().mockResolvedValue({ data: [], error: null });
    const storageFrom = vi.fn().mockReturnValue({ list });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from,
      storage: {
        from: storageFrom,
      },
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    try {
      const { GET } = await import("./route");
      const req = new NextRequest(`http://localhost/api/register/${teamId}`);
      const res = await GET(req, makeParams(teamId));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.team.id).toBe(teamId);
      expect(fetchSpy).toHaveBeenCalled();
      expect(updateRecord).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("GET keeps presentation metadata when storage list is blocked by policy", async () => {
    const stalePresentationRow = {
      ...row,
      details: {
        ...row.details,
        presentationFileName: "team-deck.pptx",
        presentationFileSizeBytes: 1024,
        presentationMimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        presentationPublicUrl: "https://example.com/public/team-deck.pptx",
        presentationStoragePath: "registrations/team-id/submission.pptx",
        presentationUploadedAt: "2026-02-20T08:00:00.000Z",
      },
    };

    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: stalePresentationRow,
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const from = vi.fn().mockReturnValueOnce({ select: existingSelect });

    const list = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "new row violates row-level security policy" },
    });
    const storageFrom = vi.fn().mockReturnValue({ list });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from,
      storage: {
        from: storageFrom,
      },
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      const { GET } = await import("./route");
      const req = new NextRequest(`http://localhost/api/register/${teamId}`);
      const res = await GET(req, makeParams(teamId));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.team.id).toBe(teamId);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("PATCH updates team when only members change", async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...row,
        details: {
          problemStatementCap: 10,
          problemStatementId: "ps-01",
          problemStatementLockedAt: "2026-02-19T08:00:00.000Z",
          problemStatementTitle: "Campus Mobility Optimizer",
          presentationFileName: "team-deck.pptx",
          presentationFileSizeBytes: 1024,
          presentationMimeType:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          presentationPublicUrl: "https://example.com/public/team-deck.pptx",
          presentationStoragePath: "registrations/team-id/submission.pptx",
          presentationUploadedAt: "2026-02-20T08:00:00.000Z",
        },
      },
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const updateRecord = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle,
            }),
          }),
        }),
      }),
    });
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ update: updateRecord });

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
        teamName: srmRecord.teamName,
        lead: srmRecord.lead,
        members: [
          {
            ...srmRecord.members[0],
            name: "M1 Updated",
          },
          srmRecord.members[1],
        ],
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    const res = await PATCH(req, makeParams(teamId));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.team.teamName).toBe("Alpha");
    expect(updateRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          members: expect.arrayContaining([
            expect.objectContaining({
              name: "M1 Updated",
            }),
          ]),
          problemStatementCap: 10,
          problemStatementId: "ps-01",
          problemStatementLockedAt: "2026-02-19T08:00:00.000Z",
          problemStatementTitle: "Campus Mobility Optimizer",
          presentationFileName: "team-deck.pptx",
          presentationFileSizeBytes: 1024,
          presentationMimeType:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          presentationPublicUrl: "https://example.com/public/team-deck.pptx",
          presentationStoragePath: "registrations/team-id/submission.pptx",
          presentationUploadedAt: "2026-02-20T08:00:00.000Z",
        }),
      }),
    );
  });

  it("PATCH rejects immutable team name changes", async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...row,
        details: {},
      },
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const updateRecord = vi.fn();
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ update: updateRecord });

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
        teamName: "Changed Team Name",
        lead: srmRecord.lead,
        members: srmRecord.members,
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    const res = await PATCH(req, makeParams(teamId));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("Team identity is locked");
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it("PATCH rejects immutable lead changes for SRM teams", async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...row,
        details: {},
      },
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const updateRecord = vi.fn();
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ update: updateRecord });

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
        teamName: srmRecord.teamName,
        lead: {
          ...srmRecord.lead,
          dept: "ECE",
        },
        members: srmRecord.members,
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    const res = await PATCH(req, makeParams(teamId));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("Team identity is locked");
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it("PATCH rejects immutable organization profile changes for non-SRM teams", async () => {
    mocks.toTeamRecord.mockReturnValue(nonSrmRecord);

    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...row,
        details: {},
      },
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const updateRecord = vi.fn();
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ update: updateRecord });

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
        teamType: "non_srm",
        teamName: nonSrmRecord.teamName,
        collegeName: "Updated College Name",
        isClub: false,
        clubName: "",
        lead: nonSrmRecord.lead,
        members: nonSrmRecord.members,
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    const res = await PATCH(req, makeParams(teamId));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("Team identity is locked");
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it("PATCH assigns a statement once for legacy teams with valid lock token", async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...row,
        details: {},
      },
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const countEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const countSelect = vi.fn().mockReturnValue({
      eq: countEq,
    });

    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const updateRecord = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle,
            }),
          }),
        }),
      }),
    });

    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ update: updateRecord });

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
        teamName: srmRecord.teamName,
        lead: srmRecord.lead,
        members: srmRecord.members,
        lockToken: "token-1",
        problemStatementId: "ps-01",
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    const res = await PATCH(req, makeParams(teamId));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.team.teamName).toBe("Alpha");
    expect(mocks.verifyProblemLockToken).toHaveBeenCalledWith({
      problemStatementId: "ps-01",
      token: "token-1",
      userId: "user-1",
    });
    expect(updateRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          problemStatementCap: 10,
          problemStatementId: "ps-01",
          problemStatementTitle: "Campus Mobility Optimizer",
        }),
      }),
    );
  });

  it("PATCH rejects statement lock reassignment for already-locked teams", async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...row,
        details: {
          problemStatementId: "ps-01",
          problemStatementTitle: "Campus Mobility Optimizer",
        },
      },
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const updateRecord = vi.fn();
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ update: updateRecord });

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
        teamName: srmRecord.teamName,
        lead: srmRecord.lead,
        members: srmRecord.members,
        lockToken: "token-2",
        problemStatementId: "ps-02",
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    const res = await PATCH(req, makeParams(teamId));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("already locked");
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it("PATCH blocks legacy statement lock assignment when statement is unavailable", async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...row,
        details: {},
      },
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const countEq = vi.fn().mockResolvedValue({
      data: Array.from({ length: 10 }).map(() => ({
        details: { problemStatementId: "ps-01" },
      })),
      error: null,
    });
    const countSelect = vi.fn().mockReturnValue({ eq: countEq });

    const updateRecord = vi.fn();
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ update: updateRecord });

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
        teamName: srmRecord.teamName,
        lead: srmRecord.lead,
        members: srmRecord.members,
        lockToken: "token-1",
        problemStatementId: "ps-01",
      }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    const res = await PATCH(req, makeParams(teamId));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("This problem statement is currently unavailable.");
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it("DELETE removes team by route param", async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...row,
        details: {},
      },
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: teamId }, error: null });
    const deleteFrom = {
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
    };
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce(deleteFrom);

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

  it("DELETE removes uploaded presentation from storage before deleting team", async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...row,
        details: {
          presentationStoragePath: "registrations/team-id/submission.pptx",
        },
      },
      error: null,
    });
    const existingSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: existingMaybeSingle,
          }),
        }),
      }),
    });

    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: teamId }, error: null });
    const deleteFrom = {
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
    };
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce(deleteFrom);

    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const storageFrom = vi.fn().mockReturnValue({ remove });

    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from,
      storage: {
        from: storageFrom,
      },
    });

    const { DELETE } = await import("./route");
    const req = new NextRequest(`http://localhost/api/register/${teamId}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams(teamId));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(storageFrom).toHaveBeenCalledWith("foundathon-presentation");
    expect(remove).toHaveBeenCalledWith(
      expect.arrayContaining(["registrations/team-id/submission.pptx"]),
    );
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
