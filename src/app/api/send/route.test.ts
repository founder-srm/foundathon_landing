import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emailTemplate: vi.fn(),
  resendConstructor: vi.fn(),
  resendSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: function MockResend(apiKey: string) {
    mocks.resendConstructor(apiKey);
    return { emails: { send: mocks.resendSend } };
  },
}));

vi.mock("@/components/email-template", () => ({
  EmailTemplate: mocks.emailTemplate,
}));

const validPayload = {
  notificationType: "lock_confirmed",
  leadName: "John Doe",
  leadEmail: "john@example.com",
  teamName: "Board Breakers",
  problemStatementId: "ps-01",
  problemStatementTitle: "Campus Mobility Optimizer",
  problemStatementSummary: "Improve first and last-mile mobility.",
  lockExpiresAtIso: "2026-02-20T10:00:00.000Z",
  lockedAtIso: "2026-02-20T09:30:00.000Z",
};

const createRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/send", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

describe("/api/send POST", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mocks.emailTemplate.mockReset();
    mocks.resendConstructor.mockReset();
    mocks.resendSend.mockReset();
    mocks.emailTemplate.mockReturnValue("<div>Email</div>");
    process.env.FOUNDATHON_RESEND_API_KEY = "resend-key";
    process.env.SITE_URL = "https://foundathon.example";
    process.env.NEXT_PUBLIC_SITE_URL = "https://public-foundathon.example";
  });

  it("returns sent:true for valid payload and successful provider call", async () => {
    mocks.resendSend.mockResolvedValue({
      data: { id: "email-1" },
      error: null,
    });

    const { POST } = await import("./route");
    const response = await POST(createRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ id: "email-1", sent: true });
    expect(mocks.resendConstructor).toHaveBeenCalledWith("resend-key");
    expect(mocks.emailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        ctaBaseUrl: "https://foundathon.example",
        leadEmail: validPayload.leadEmail,
        leadName: validPayload.leadName,
        problemStatementTitle: validPayload.problemStatementTitle,
      }),
    );
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Admin <no-reply@thefoundersclub.tech>",
        subject:
          "Foundathon: Problem Statement Locked - Campus Mobility Optimizer",
        to: [validPayload.leadEmail],
      }),
    );
  });

  it("uses NEXT_PUBLIC_SITE_URL when SITE_URL is missing", async () => {
    process.env.SITE_URL = "";
    process.env.NEXT_PUBLIC_SITE_URL = "https://public-foundathon.example";
    mocks.resendSend.mockResolvedValue({
      data: { id: "email-2" },
      error: null,
    });

    const { POST } = await import("./route");
    const response = await POST(createRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sent).toBe(true);
    expect(mocks.emailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        ctaBaseUrl: "https://public-foundathon.example",
      }),
    );
  });

  it("returns sent:false with missing_api_key when API key is not configured", async () => {
    delete process.env.FOUNDATHON_RESEND_API_KEY;

    const { POST } = await import("./route");
    const response = await POST(createRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      reason: "missing_api_key",
      sent: false,
    });
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payloads", async () => {
    const { POST } = await import("./route");
    const response = await POST(createRequest({ leadEmail: "bad" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.sent).toBe(false);
    expect(body.reason).toBe("invalid_payload");
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it("returns provider_error when resend responds with an error", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.resendSend.mockResolvedValue({
      data: null,
      error: { message: "Provider down" },
    });

    const { POST } = await import("./route");
    const response = await POST(createRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      error: "Provider down",
      reason: "provider_error",
      sent: false,
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("uses abandoned subject and payload when notification type is lock_abandoned", async () => {
    mocks.resendSend.mockResolvedValue({
      data: { id: "email-3" },
      error: null,
    });

    const { POST } = await import("./route");
    const response = await POST(
      createRequest({
        ...validPayload,
        abandonedAtIso: "2026-02-20T09:45:00.000Z",
        notificationType: "lock_abandoned",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sent).toBe(true);
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject:
          "Foundathon: Registration Abandoned - Campus Mobility Optimizer",
      }),
    );
    expect(mocks.emailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        abandonedAtIso: "2026-02-20T09:45:00.000Z",
        notificationType: "lock_abandoned",
      }),
    );
  });
});
