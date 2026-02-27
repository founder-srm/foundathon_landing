import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(),
  getSupabaseCredentials: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/register-api", () => ({
  createSupabaseClient: mocks.createSupabaseClient,
  getSupabaseCredentials: mocks.getSupabaseCredentials,
}));

describe("getRouteAuthContext", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.createSupabaseClient.mockReset();
    mocks.getSupabaseCredentials.mockReset();
    mocks.getUser.mockReset();
    mocks.signOut.mockReset();

    mocks.getSupabaseCredentials.mockReturnValue({
      anonKey: "anon-key",
      url: "https://supabase.local",
    });
    mocks.getUser.mockResolvedValue({
      data: { user: { email: "lead@example.com", id: "user-1" } },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.createSupabaseClient.mockResolvedValue({
      auth: {
        getUser: mocks.getUser,
        signOut: mocks.signOut,
      },
    });
  });

  it("returns 500 response when supabase credentials are missing", async () => {
    mocks.getSupabaseCredentials.mockReturnValue(null);

    const { getRouteAuthContext } = await import("./context");
    const result = await getRouteAuthContext();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected unauthenticated context result");
    }

    expect(result.response.status).toBe(500);
    expect(await result.response.json()).toEqual({
      error: "Supabase environment variables are not configured.",
    });
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns unauthorized when user is missing", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { getRouteAuthContext } = await import("./context");
    const result = await getRouteAuthContext();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected unauthenticated context result");
    }

    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("signs out and returns unauthorized for blocked srm email", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { email: "  BLOCKED@SRMIST.EDU.IN ", id: "user-2" } },
      error: null,
    });

    const { getRouteAuthContext } = await import("./context");
    const result = await getRouteAuthContext();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected unauthenticated context result");
    }

    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("returns authenticated context for allowed email", async () => {
    const { getRouteAuthContext } = await import("./context");
    const result = await getRouteAuthContext();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected authenticated context result");
    }

    expect(result.user.id).toBe("user-1");
    expect(result.user.email).toBe("lead@example.com");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
