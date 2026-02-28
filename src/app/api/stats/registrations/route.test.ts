import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFoundathonStatsApiKey: vi.fn(),
  getRegistrationStats: vi.fn(),
}));

vi.mock("@/server/env", () => ({
  getFoundathonStatsApiKey: mocks.getFoundathonStatsApiKey,
}));

vi.mock("@/server/registration-stats/service", () => ({
  getRegistrationStats: mocks.getRegistrationStats,
}));

describe("/api/stats/registrations GET", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getFoundathonStatsApiKey.mockReset();
    mocks.getRegistrationStats.mockReset();

    mocks.getFoundathonStatsApiKey.mockReturnValue("stats-secret");
    mocks.getRegistrationStats.mockResolvedValue({
      data: {
        generatedAt: "2026-02-28T00:00:00.000Z",
      },
      ok: true,
      status: 200,
    });
  });

  it("returns 500 when stats API key is not configured", async () => {
    mocks.getFoundathonStatsApiKey.mockReturnValue(null);
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest("http://localhost/api/stats/registrations"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Stats API key is not configured.");
    expect(mocks.getRegistrationStats).not.toHaveBeenCalled();
  });

  it("returns 401 when header is missing", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest("http://localhost/api/stats/registrations"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mocks.getRegistrationStats).not.toHaveBeenCalled();
  });

  it("returns 401 when header is invalid", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest("http://localhost/api/stats/registrations", {
        headers: { "x-foundathon-stats-key": "wrong-secret" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mocks.getRegistrationStats).not.toHaveBeenCalled();
  });

  it("accepts trimmed stats API key from env", async () => {
    mocks.getFoundathonStatsApiKey.mockReturnValue("  stats-secret  ");
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest("http://localhost/api/stats/registrations", {
        headers: { "x-foundathon-stats-key": "stats-secret" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedAt).toBe("2026-02-28T00:00:00.000Z");
  });

  it("returns service errors", async () => {
    mocks.getRegistrationStats.mockResolvedValue({
      error: "Failed to fetch registrations for stats.",
      ok: false,
      status: 500,
    });
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest("http://localhost/api/stats/registrations", {
        headers: { "x-foundathon-stats-key": "stats-secret" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to fetch registrations for stats.");
  });

  it("returns 200 with no-store header on success", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest("http://localhost/api/stats/registrations", {
        headers: { "x-foundathon-stats-key": "stats-secret" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.generatedAt).toBe("2026-02-28T00:00:00.000Z");
  });
});
