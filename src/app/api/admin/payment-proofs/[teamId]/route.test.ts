import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceSameOrigin: vi.fn(),
  getRouteAuthContext: vi.fn(),
  hasAdminReviewAccess: vi.fn(),
  updateAdminPaymentDecision: vi.fn(),
}));

vi.mock("@/server/security/csrf", () => ({
  enforceSameOrigin: mocks.enforceSameOrigin,
}));

vi.mock("@/server/auth/context", () => ({
  getRouteAuthContext: mocks.getRouteAuthContext,
}));

vi.mock("@/server/admin/review-access", () => ({
  hasAdminReviewAccess: mocks.hasAdminReviewAccess,
}));

vi.mock("@/server/admin/payment-proofs", () => ({
  updateAdminPaymentDecision: mocks.updateAdminPaymentDecision,
}));

const makeParams = (teamId: string) => ({
  params: Promise.resolve({ teamId }),
});

describe("/api/admin/payment-proofs/[teamId] PATCH", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.enforceSameOrigin.mockReset();
    mocks.getRouteAuthContext.mockReset();
    mocks.hasAdminReviewAccess.mockReset();
    mocks.updateAdminPaymentDecision.mockReset();

    mocks.enforceSameOrigin.mockReturnValue(null);
    mocks.getRouteAuthContext.mockResolvedValue({
      ok: true,
      supabase: {},
      user: { email: "admin@example.com", id: "user-1" },
    });
    mocks.hasAdminReviewAccess.mockResolvedValue(true);
    mocks.updateAdminPaymentDecision.mockResolvedValue({
      data: {
        paymentRejectedReason: null,
        paymentReviewedAt: "2026-03-07T10:05:00.000Z",
        paymentStatus: "approved",
        teamId: "11111111-1111-4111-8111-111111111111",
      },
      ok: true,
      status: 200,
    });
  });

  it("returns 403 when CSRF validation fails", async () => {
    mocks.enforceSameOrigin.mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { "content-type": "application/json" },
        status: 403,
      }),
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest(
        "http://localhost/api/admin/payment-proofs/11111111-1111-4111-8111-111111111111",
        {
          body: JSON.stringify({ decision: "approved" }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        },
      ),
      makeParams("11111111-1111-4111-8111-111111111111"),
    );

    expect(response.status).toBe(403);
    expect(mocks.updateAdminPaymentDecision).not.toHaveBeenCalled();
  });

  it("rejects invalid payload shape", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest(
        "http://localhost/api/admin/payment-proofs/11111111-1111-4111-8111-111111111111",
        {
          body: JSON.stringify({ decision: "rejected" }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        },
      ),
      makeParams("11111111-1111-4111-8111-111111111111"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/rejection reason/i);
    expect(mocks.updateAdminPaymentDecision).not.toHaveBeenCalled();
  });

  it("returns service response on success", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest(
        "http://localhost/api/admin/payment-proofs/11111111-1111-4111-8111-111111111111",
        {
          body: JSON.stringify({ decision: "approved" }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        },
      ),
      makeParams("11111111-1111-4111-8111-111111111111"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.updateAdminPaymentDecision).toHaveBeenCalledWith({
      decision: "approved",
      reason: undefined,
      teamId: "11111111-1111-4111-8111-111111111111",
    });
    expect(body.paymentStatus).toBe("approved");
  });
});
