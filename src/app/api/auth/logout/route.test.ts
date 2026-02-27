import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRootRedirect: vi.fn(),
  signOutCurrentUser: vi.fn(),
}));

vi.mock("@/server/auth/oauth", () => ({
  resolveRootRedirect: mocks.resolveRootRedirect,
  signOutCurrentUser: mocks.signOutCurrentUser,
}));

describe("/api/auth/logout", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.resolveRootRedirect.mockReset();
    mocks.signOutCurrentUser.mockReset();

    mocks.resolveRootRedirect.mockReturnValue("http://localhost/");
    mocks.signOutCurrentUser.mockResolvedValue(undefined);
  });

  it("does not expose a GET handler", async () => {
    const routeModule = await import("./route");
    expect("GET" in routeModule).toBe(false);
  });

  it("POST rejects CSRF mismatch", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/auth/logout", {
      headers: { origin: "https://evil.example" },
      method: "POST",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("CSRF_FAILED");
    expect(mocks.signOutCurrentUser).not.toHaveBeenCalled();
  });

  it("POST signs out and redirects with 303", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/auth/logout", {
      headers: { origin: "http://localhost" },
      method: "POST",
    });

    const response = await POST(request);

    expect(mocks.signOutCurrentUser).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });
});
