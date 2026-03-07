import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRouteAuthContext: vi.fn(),
  hasAdminReviewAccess: vi.fn(),
  listAdminPaymentProofs: vi.fn(),
}));

vi.mock("@/server/auth/context", () => ({
  getRouteAuthContext: mocks.getRouteAuthContext,
}));

vi.mock("@/server/admin/review-access", () => ({
  hasAdminReviewAccess: mocks.hasAdminReviewAccess,
}));

vi.mock("@/server/admin/payment-proofs", () => ({
  listAdminPaymentProofs: mocks.listAdminPaymentProofs,
}));

describe("/api/admin/payment-proofs GET", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getRouteAuthContext.mockReset();
    mocks.hasAdminReviewAccess.mockReset();
    mocks.listAdminPaymentProofs.mockReset();

    mocks.getRouteAuthContext.mockResolvedValue({
      ok: true,
      supabase: {},
      user: { email: "admin@example.com", id: "user-1" },
    });
    mocks.hasAdminReviewAccess.mockResolvedValue(true);
    mocks.listAdminPaymentProofs.mockResolvedValue({
      data: {
        statement: "all",
        teams: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            leadName: "Lead",
            paymentRejectedReason: null,
            paymentReviewedAt: null,
            paymentStatus: "submitted",
            paymentSubmittedAt: "2026-03-07T10:00:00.000Z",
            paymentUtr: "UTR123456",
            problemStatementId: "ps-01",
            problemStatementTitle: "Problem",
            registrationEmail: "team@example.com",
            teamName: "Team A",
          },
        ],
      },
      ok: true,
      status: 200,
    });
  });

  it("forwards unauthenticated auth response", async () => {
    mocks.getRouteAuthContext.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { "content-type": "application/json" },
        status: 401,
      }),
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("http://localhost/api/admin/payment-proofs"),
    );

    expect(response.status).toBe(401);
    expect(mocks.listAdminPaymentProofs).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admin users", async () => {
    mocks.hasAdminReviewAccess.mockResolvedValueOnce(false);

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("http://localhost/api/admin/payment-proofs"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("rejects invalid statement query params", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/payment-proofs?statement=bad-statement",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/invalid statement/i);
  });

  it("returns payment proofs for a valid statement filter", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/payment-proofs?statement=ps-01",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.listAdminPaymentProofs).toHaveBeenCalledWith({
      statement: "ps-01",
    });
    expect(body.teams).toHaveLength(1);
  });
});
