import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRouteAuthContext: vi.fn(),
  submitTeamPresentation: vi.fn(),
}));

vi.mock("@/server/auth/context", () => ({
  getRouteAuthContext: mocks.getRouteAuthContext,
}));

vi.mock("@/server/registration/service", () => ({
  submitTeamPresentation: mocks.submitTeamPresentation,
}));

const teamId = "11111111-1111-4111-8111-111111111111";

const makeParams = (id: string) => ({
  params: Promise.resolve({ teamId: id }),
});

const supabaseClient = {};

const buildRequest = (formData: FormData) =>
  ({
    formData: vi.fn().mockResolvedValue(formData),
  }) as unknown as NextRequest;

const validFile = () =>
  new File(["slide"], "team-deck.pptx", {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });

const uploadedTeam = {
  id: teamId,
  createdAt: "2026-02-20T10:00:00.000Z",
  updatedAt: "2026-02-20T10:05:00.000Z",
  teamType: "srm" as const,
  teamName: "Pitch Pioneers",
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
  presentationFileName: "team-deck.pptx",
  presentationFileSizeBytes: 1024,
  presentationMimeType:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  presentationPublicUrl: "https://example.com/public/team-deck.pptx",
  presentationStoragePath: "user-1/team-id/submission.pptx",
  presentationUploadedAt: "2026-02-20T10:05:00.000Z",
  problemStatementCap: 10,
  problemStatementId: "ps-01",
  problemStatementLockedAt: "2026-02-19T08:00:00.000Z",
  problemStatementTitle: "Campus Mobility Optimizer",
};

describe("/api/register/[teamId]/presentation route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getRouteAuthContext.mockReset();
    mocks.submitTeamPresentation.mockReset();

    mocks.getRouteAuthContext.mockResolvedValue({
      ok: true,
      supabase: supabaseClient as never,
      user: { id: "user-1" },
    });
  });

  it("returns 401 for unauthenticated users", async () => {
    mocks.getRouteAuthContext.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const formData = new FormData();
    formData.set("file", validFile());

    const { POST } = await import("./route");
    const response = await POST(buildRequest(formData), makeParams(teamId));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mocks.submitTeamPresentation).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid team id", async () => {
    const formData = new FormData();
    formData.set("file", validFile());

    const { POST } = await import("./route");
    const response = await POST(
      buildRequest(formData),
      makeParams("not-a-valid-team-id"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Team id is invalid.");
    expect(mocks.getRouteAuthContext).not.toHaveBeenCalled();
    expect(mocks.submitTeamPresentation).not.toHaveBeenCalled();
  });

  it("returns 400 when file is missing", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      buildRequest(new FormData()),
      makeParams(teamId),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Presentation file is required.");
    expect(mocks.submitTeamPresentation).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid extension or mime type", async () => {
    mocks.submitTeamPresentation.mockResolvedValue({
      error: "Only .ppt or .pptx files are allowed.",
      ok: false,
      status: 400,
    });

    const formData = new FormData();
    formData.set(
      "file",
      new File(["bad"], "team-deck.pdf", { type: "application/pdf" }),
    );

    const { POST } = await import("./route");
    const response = await POST(buildRequest(formData), makeParams(teamId));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Only .ppt or .pptx files are allowed.");
  });

  it("returns 400 for files larger than 5MB", async () => {
    mocks.submitTeamPresentation.mockResolvedValue({
      error: "Presentation file size must be 5 MB or less.",
      ok: false,
      status: 400,
    });

    const largeFile = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      "team-deck.pptx",
      {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      },
    );
    const formData = new FormData();
    formData.set("file", largeFile);

    const { POST } = await import("./route");
    const response = await POST(buildRequest(formData), makeParams(teamId));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Presentation file size must be 5 MB or less.");
  });

  it("returns 404 when team is not found", async () => {
    mocks.submitTeamPresentation.mockResolvedValue({
      error: "Team not found.",
      ok: false,
      status: 404,
    });

    const formData = new FormData();
    formData.set("file", validFile());

    const { POST } = await import("./route");
    const response = await POST(buildRequest(formData), makeParams(teamId));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Team not found.");
  });

  it("returns 409 when presentation is already submitted", async () => {
    mocks.submitTeamPresentation.mockResolvedValue({
      error: "Presentation already submitted for this team.",
      ok: false,
      status: 409,
    });

    const formData = new FormData();
    formData.set("file", validFile());

    const { POST } = await import("./route");
    const response = await POST(buildRequest(formData), makeParams(teamId));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Presentation already submitted for this team.");
  });

  it("returns 500 when storage upload fails", async () => {
    mocks.submitTeamPresentation.mockResolvedValue({
      error: "Failed to upload presentation.",
      ok: false,
      status: 500,
    });

    const formData = new FormData();
    formData.set("file", validFile());

    const { POST } = await import("./route");
    const response = await POST(buildRequest(formData), makeParams(teamId));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to upload presentation.");
  });

  it("returns team presentation metadata after successful upload", async () => {
    mocks.submitTeamPresentation.mockResolvedValue({
      data: { team: uploadedTeam },
      ok: true,
      status: 200,
    });

    const formData = new FormData();
    const file = validFile();
    formData.set("file", file);

    const { POST } = await import("./route");
    const response = await POST(buildRequest(formData), makeParams(teamId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.team.presentationPublicUrl).toBe(
      "https://example.com/public/team-deck.pptx",
    );
    expect(body.team.presentationFileName).toBe("team-deck.pptx");
    expect(mocks.submitTeamPresentation).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          file: expect.any(File),
          teamId,
        }),
        supabase: supabaseClient,
        userId: "user-1",
      }),
    );
    const call = mocks.submitTeamPresentation.mock.calls[0]?.[0];
    expect(call.input.file.name).toBe(file.name);
  });
});
