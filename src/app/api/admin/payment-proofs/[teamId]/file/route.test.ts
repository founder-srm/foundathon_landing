import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceIpRateLimit: vi.fn(),
  enforceUserRateLimit: vi.fn(),
  getAdminPaymentProofDownloadUrl: vi.fn(),
  getRouteAuthContext: vi.fn(),
  hasAdminReviewAccess: vi.fn(),
}));

vi.mock("@/server/security/rate-limit", () => ({
  enforceIpRateLimit: mocks.enforceIpRateLimit,
  enforceUserRateLimit: mocks.enforceUserRateLimit,
}));

vi.mock("@/server/auth/context", () => ({
  getRouteAuthContext: mocks.getRouteAuthContext,
}));

vi.mock("@/server/admin/review-access", () => ({
  hasAdminReviewAccess: mocks.hasAdminReviewAccess,
}));

vi.mock("@/server/admin/payment-proofs", () => ({
  getAdminPaymentProofDownloadUrl: mocks.getAdminPaymentProofDownloadUrl,
}));

const makeParams = (teamId: string) => ({
  params: Promise.resolve({ teamId }),
});

describe("/api/admin/payment-proofs/[teamId]/file GET", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.enforceIpRateLimit.mockReset();
    mocks.enforceUserRateLimit.mockReset();
    mocks.getAdminPaymentProofDownloadUrl.mockReset();
    mocks.getRouteAuthContext.mockReset();
    mocks.hasAdminReviewAccess.mockReset();

    mocks.enforceIpRateLimit.mockResolvedValue(null);
    mocks.enforceUserRateLimit.mockResolvedValue(null);
    mocks.getRouteAuthContext.mockResolvedValue({
      ok: true,
      supabase: {},
      user: { email: "admin@example.com", id: "user-1" },
    });
    mocks.hasAdminReviewAccess.mockResolvedValue(true);
    mocks.getAdminPaymentProofDownloadUrl.mockResolvedValue({
      data: { url: "https://example.com/admin-signed-proof" },
      ok: true,
      status: 200,
    });
  });

  it("redirects admins to the signed proof URL", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/payment-proofs/11111111-1111-4111-8111-111111111111/file",
      ),
      makeParams("11111111-1111-4111-8111-111111111111"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://example.com/admin-signed-proof",
    );
  });

  it("forwards unauthenticated responses", async () => {
    mocks.getRouteAuthContext.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/payment-proofs/11111111-1111-4111-8111-111111111111/file",
      ),
      makeParams("11111111-1111-4111-8111-111111111111"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });
});
