import { describe, expect, it, vi } from "vitest";
import { enforceSameOrigin } from "@/server/security/csrf";

describe("enforceSameOrigin", () => {
  it("accepts requests with matching Origin header", () => {
    const request = new Request("http://localhost/api/register", {
      headers: { origin: "http://localhost" },
      method: "POST",
    });

    expect(enforceSameOrigin(request)).toBeNull();
  });

  it("accepts requests with matching Referer origin", () => {
    const request = new Request("http://localhost/api/register", {
      headers: { referer: "http://localhost/register?step=2" },
      method: "POST",
    });

    expect(enforceSameOrigin(request)).toBeNull();
  });

  it("rejects requests from mismatched origins", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const request = new Request("http://localhost/api/register", {
      headers: {
        origin: "https://evil.example",
        referer: "https://evil.example/form",
      },
      method: "POST",
    });

    const response = enforceSameOrigin(request);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({
      code: "CSRF_FAILED",
      error: "CSRF validation failed.",
    });

    warnSpy.mockRestore();
  });

  it("rejects requests without Origin or Referer", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const request = new Request("http://localhost/api/register", {
      method: "POST",
    });

    const response = enforceSameOrigin(request);
    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({
      code: "CSRF_FAILED",
      error: "CSRF validation failed.",
    });

    warnSpy.mockRestore();
  });
});
