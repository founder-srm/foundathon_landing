import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFoundathonResendApiKey: vi.fn(),
  getFoundathonSiteUrl: vi.fn(),
  resendSend: vi.fn(),
}));

vi.mock("@/server/env", () => ({
  getFoundathonResendApiKey: mocks.getFoundathonResendApiKey,
  getFoundathonSiteUrl: mocks.getFoundathonSiteUrl,
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mocks.resendSend,
    },
  })),
}));

describe("team decision mail service", () => {
  const teamId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.resetModules();
    mocks.getFoundathonResendApiKey.mockReset();
    mocks.getFoundathonSiteUrl.mockReset();
    mocks.resendSend.mockReset();

    mocks.getFoundathonResendApiKey.mockReturnValue("resend-key");
    mocks.getFoundathonSiteUrl.mockReturnValue("https://example.com");
    mocks.resendSend.mockResolvedValue({ error: null });
  });

  it("builds accepted mail content with team and statement details", async () => {
    const { getTeamDecisionEmailContent } = await import("./team-decision");
    const content = getTeamDecisionEmailContent({
      decision: "accepted",
      problemStatementTitle: "Localized AI Skills Training Platform",
      siteUrl: "https://example.com",
      teamId,
      teamName: "Pitch Panthers",
    });

    expect(content.subject).toContain("Accepted");
    expect(content.text).toContain("Pitch Panthers");
    expect(content.text).toContain("Localized AI Skills Training Platform");
    expect(content.text).toContain("INR 300");
    expect(content.text).toContain("Registration Status: ACCEPTED");
    expect(content.text).toContain("INR 300 payment");
    expect(content.text).toContain("Transaction ID / UTR");
    expect(content.text).toContain("top-right of the Team Status card");
    expect(content.text).toContain(`https://example.com/dashboard/${teamId}`);
    expect(content.html).toContain("Pitch Panthers");
    expect(content.html).toContain("Localized AI Skills Training Platform");
    expect(content.html).toContain("Registration Status:</strong> ACCEPTED");
    expect(content.html).toContain("INR 300 payment</strong>");
    expect(content.html).toContain("payment proof");
    expect(content.html).toContain("top-right of the Team Status card");
    expect(content.html).toContain(`https://example.com/dashboard/${teamId}`);
  });

  it("builds rejected mail content with team and statement details", async () => {
    const { getTeamDecisionEmailContent } = await import("./team-decision");
    const content = getTeamDecisionEmailContent({
      decision: "rejected",
      problemStatementTitle: "AI Matchmaking for Cross-Industry Innovation",
      siteUrl: "https://example.com",
      teamId,
      teamName: "Board Breakers",
    });

    expect(content.subject).toContain("Status");
    expect(content.text).toContain("Board Breakers");
    expect(content.text).toContain(
      "AI Matchmaking for Cross-Industry Innovation",
    );
    expect(content.text).toContain("Registration Status: REJECTED");
    expect(content.text).toContain(`https://example.com/dashboard/${teamId}`);
    expect(content.html).toContain("Board Breakers");
    expect(content.html).toContain(
      "AI Matchmaking for Cross-Industry Innovation",
    );
    expect(content.html).toContain("Registration Status:</strong> REJECTED");
    expect(content.html).toContain(`https://example.com/dashboard/${teamId}`);
  });

  it("returns validation error when registration email is invalid", async () => {
    const { sendTeamDecisionMail } = await import("./team-decision");
    const result = await sendTeamDecisionMail({
      decision: "accepted",
      problemStatementTitle: "PS",
      recipientEmail: "not-an-email",
      teamId,
      teamName: "Team A",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.status).toBe(400);
    expect(result.error).toMatch(/invalid recipient email/i);
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it("returns config error when resend key is missing", async () => {
    mocks.getFoundathonResendApiKey.mockReturnValueOnce(null);

    const { sendTeamDecisionMail } = await import("./team-decision");
    const result = await sendTeamDecisionMail({
      decision: "accepted",
      problemStatementTitle: "PS",
      recipientEmail: "team@example.com",
      teamId,
      teamName: "Team A",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.status).toBe(500);
    expect(result.error).toMatch(/FOUNDATHON_RESEND_API_KEY/i);
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it("sends decision mail successfully", async () => {
    const { sendTeamDecisionMail } = await import("./team-decision");
    const result = await sendTeamDecisionMail({
      decision: "accepted",
      problemStatementTitle: "PS",
      recipientEmail: "TEAM@EXAMPLE.COM",
      teamId,
      teamName: "Team A",
    });

    expect(result).toEqual({
      ok: true,
      recipient: "team@example.com",
    });
    expect(mocks.resendSend).toHaveBeenCalledTimes(1);

    const call = mocks.resendSend.mock.calls[0]?.[0];
    expect(call.to).toBe("team@example.com");
    expect(call.subject).toMatch(/Accepted/i);
    expect(call.text).toContain("Team A");
    expect(call.text).toContain(`https://example.com/dashboard/${teamId}`);
  });

  it("normalizes registration email before sending", async () => {
    const { sendTeamDecisionMail } = await import("./team-decision");
    const result = await sendTeamDecisionMail({
      decision: "accepted",
      problemStatementTitle: "PS",
      recipientEmail: "Different-Team@Example.Com",
      teamId,
      teamName: "Team A",
    });

    expect(result).toEqual({
      ok: true,
      recipient: "different-team@example.com",
    });
    const call = mocks.resendSend.mock.calls[0]?.[0];
    expect(call.to).toBe("different-team@example.com");
  });

  it("surfaces resend provider errors", async () => {
    mocks.resendSend.mockResolvedValueOnce({
      error: { message: "provider down" },
    });

    const { sendTeamDecisionMail } = await import("./team-decision");
    const result = await sendTeamDecisionMail({
      decision: "rejected",
      problemStatementTitle: "PS",
      recipientEmail: "team@example.com",
      teamId,
      teamName: "Team A",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.status).toBe(502);
    expect(result.error).toContain("provider down");
  });
});
