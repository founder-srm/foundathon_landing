import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServiceRoleSupabaseClient: vi.fn(),
}));

vi.mock("@/server/supabase/service-role-client", () => ({
  getServiceRoleSupabaseClient: mocks.getServiceRoleSupabaseClient,
}));

describe("admin payment proofs service", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getServiceRoleSupabaseClient.mockReset();
  });

  it("lists accepted teams with payment metadata", async () => {
    mocks.getServiceRoleSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  details: {
                    lead: { name: "Lead One" },
                    paymentStatus: "submitted",
                    paymentSubmittedAt: "2026-03-07T10:00:00.000Z",
                    paymentUtr: "UTR123456",
                    problemStatementId: "ps-01",
                    problemStatementTitle: "Problem A",
                    teamName: "Team One",
                  },
                  id: "11111111-1111-4111-8111-111111111111",
                  is_approved: "ACCEPTED",
                  registration_email: "one@example.com",
                },
                {
                  details: {
                    teamName: "Team Two",
                  },
                  id: "22222222-2222-4222-8222-222222222222",
                  is_approved: "REJECTED",
                  registration_email: "two@example.com",
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });

    const { listAdminPaymentProofs } = await import("./payment-proofs");
    const result = await listAdminPaymentProofs({ statement: "all" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.teams).toHaveLength(1);
    expect(result.data.teams[0]?.paymentStatus).toBe("submitted");
    expect(result.data.teams[0]?.paymentUtr).toBe("UTR123456");
  });

  it("approves submitted payment proofs", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                details: {
                  paymentStatus: "approved",
                },
                id: "11111111-1111-4111-8111-111111111111",
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const from = vi
      .fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  details: {
                    paymentStatus: "submitted",
                    paymentSubmittedAt: "2026-03-07T10:00:00.000Z",
                    paymentUtr: "UTR123456",
                  },
                  id: "11111111-1111-4111-8111-111111111111",
                  is_approved: "ACCEPTED",
                  registration_email: "team@example.com",
                },
                error: null,
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({ update });

    mocks.getServiceRoleSupabaseClient.mockReturnValue({ from });

    const { updateAdminPaymentDecision } = await import("./payment-proofs");
    const result = await updateAdminPaymentDecision({
      decision: "approved",
      teamId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(update).toHaveBeenCalledWith({
      details: expect.objectContaining({
        paymentReviewedAt: expect.any(String),
        paymentStatus: "approved",
      }),
    });
    expect(result.data.paymentStatus).toBe("approved");
  });

  it("requires a rejection reason when rejecting a payment proof", async () => {
    const { updateAdminPaymentDecision } = await import("./payment-proofs");
    const result = await updateAdminPaymentDecision({
      decision: "rejected",
      reason: "   ",
      teamId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.status).toBe(400);
    expect(result.error).toMatch(/rejection reason/i);
  });
});
