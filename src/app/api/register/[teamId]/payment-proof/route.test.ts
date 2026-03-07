import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceIpRateLimit: vi.fn(),
  enforceSameOrigin: vi.fn(),
  enforceUserRateLimit: vi.fn(),
  getRouteAuthContext: vi.fn(),
  getTeamPaymentProofDownloadUrl: vi.fn(),
  submitTeamPaymentProof: vi.fn(),
}));

vi.mock("@/server/auth/context", () => ({
  getRouteAuthContext: mocks.getRouteAuthContext,
}));

vi.mock("@/server/security/csrf", () => ({
  enforceSameOrigin: mocks.enforceSameOrigin,
}));

vi.mock("@/server/security/rate-limit", () => ({
  enforceIpRateLimit: mocks.enforceIpRateLimit,
  enforceUserRateLimit: mocks.enforceUserRateLimit,
}));

vi.mock("@/server/registration/payment-proofs", () => ({
  getTeamPaymentProofDownloadUrl: mocks.getTeamPaymentProofDownloadUrl,
  submitTeamPaymentProof: mocks.submitTeamPaymentProof,
}));

const teamId = "11111111-1111-4111-8111-111111111111";
const supabaseClient = {};

const makeParams = (id: string) => ({
  params: Promise.resolve({ teamId: id }),
});

const buildRequest = (formData: FormData) =>
  ({
    formData: vi.fn().mockResolvedValue(formData),
    headers: new Headers(),
    url: "http://localhost/api/register/team/payment-proof",
  }) as unknown as NextRequest;

const validFile = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "proof.png", {
    type: "image/png",
  });

const uploadedTeam = {
  id: teamId,
  createdAt: "2026-02-20T10:00:00.000Z",
  paymentProofFileName: "proof.png",
  paymentProofFileSizeBytes: 2048,
  paymentProofMimeType: "image/png",
  paymentProofStoragePath: "payment-proofs/user-1/team/proof.png",
  paymentStatus: "submitted" as const,
  paymentSubmittedAt: "2026-03-07T10:05:00.000Z",
  paymentUtr: "UTR123456789",
  teamType: "srm" as const,
  teamName: "Pitch Pioneers",
  updatedAt: "2026-02-20T10:05:00.000Z",
  lead: {
    contact: 9876543210,
    dept: "CSE",
    name: "Lead",
    netId: "od7270",
    raNumber: "RA0000000000001",
  },
  members: [
    {
      contact: 9876543211,
      dept: "CSE",
      name: "M1",
      netId: "ab1234",
      raNumber: "RA0000000000002",
    },
    {
      contact: 9876543212,
      dept: "ECE",
      name: "M2",
      netId: "cd5678",
      raNumber: "RA0000000000003",
    },
  ],
};

describe("/api/register/[teamId]/payment-proof route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.enforceIpRateLimit.mockReset();
    mocks.enforceSameOrigin.mockReset();
    mocks.enforceUserRateLimit.mockReset();
    mocks.getRouteAuthContext.mockReset();
    mocks.getTeamPaymentProofDownloadUrl.mockReset();
    mocks.submitTeamPaymentProof.mockReset();

    mocks.enforceIpRateLimit.mockResolvedValue(null);
    mocks.enforceSameOrigin.mockReturnValue(null);
    mocks.enforceUserRateLimit.mockResolvedValue(null);
    mocks.getRouteAuthContext.mockResolvedValue({
      ok: true,
      supabase: supabaseClient as never,
      user: { id: "user-1" },
    });
  });

  it("POST returns 403 when CSRF validation fails", async () => {
    mocks.enforceSameOrigin.mockReturnValue(
      new Response(JSON.stringify({ code: "CSRF_FAILED" }), {
        headers: { "content-type": "application/json" },
        status: 403,
      }),
    );

    const formData = new FormData();
    formData.set("file", validFile());
    formData.set("utr", "UTR123456");

    const { POST } = await import("./route");
    const response = await POST(buildRequest(formData), makeParams(teamId));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("CSRF_FAILED");
    expect(mocks.getRouteAuthContext).not.toHaveBeenCalled();
  });

  it("POST returns 400 when file is missing", async () => {
    const formData = new FormData();
    formData.set("utr", "UTR123456");

    const { POST } = await import("./route");
    const response = await POST(buildRequest(formData), makeParams(teamId));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Payment proof file is required.");
    expect(mocks.submitTeamPaymentProof).not.toHaveBeenCalled();
  });

  it("POST returns 400 when Transaction ID / UTR is missing", async () => {
    const formData = new FormData();
    formData.set("file", validFile());

    const { POST } = await import("./route");
    const response = await POST(buildRequest(formData), makeParams(teamId));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Transaction ID / UTR is required.");
    expect(mocks.submitTeamPaymentProof).not.toHaveBeenCalled();
  });

  it("POST returns service success", async () => {
    mocks.submitTeamPaymentProof.mockResolvedValue({
      data: { team: uploadedTeam },
      ok: true,
      status: 200,
    });

    const formData = new FormData();
    formData.set("file", validFile());
    formData.set("utr", "UTR123456");

    const { POST } = await import("./route");
    const response = await POST(buildRequest(formData), makeParams(teamId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.submitTeamPaymentProof).toHaveBeenCalledWith({
      input: {
        file: expect.any(File),
        teamId,
        utr: "UTR123456",
      },
      supabase: supabaseClient,
      userId: "user-1",
    });
    expect(body.team.paymentStatus).toBe("submitted");
  });

  it("GET redirects to the signed payment proof URL", async () => {
    mocks.getTeamPaymentProofDownloadUrl.mockResolvedValue({
      data: { url: "https://example.com/signed-proof" },
      ok: true,
      status: 200,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        `http://localhost/api/register/${teamId}/payment-proof`,
      ) as NextRequest,
      makeParams(teamId),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://example.com/signed-proof",
    );
  });

  it("GET forwards service errors", async () => {
    mocks.getTeamPaymentProofDownloadUrl.mockResolvedValue({
      error: "Payment proof not found.",
      ok: false,
      status: 404,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        `http://localhost/api/register/${teamId}/payment-proof`,
      ) as NextRequest,
      makeParams(teamId),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("Payment proof not found");
  });

  it("GET forwards unauthenticated responses", async () => {
    mocks.getRouteAuthContext.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        `http://localhost/api/register/${teamId}/payment-proof`,
      ) as NextRequest,
      makeParams(teamId),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });
});
