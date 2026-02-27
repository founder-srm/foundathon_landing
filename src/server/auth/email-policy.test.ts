import { describe, expect, it } from "vitest";
import {
  AUTH_ERROR_REASON_SRM_BLOCKED,
  BLOCKED_LOGIN_EMAIL_DOMAIN,
  isBlockedLoginEmail,
} from "./email-policy";

describe("email-policy", () => {
  it("matches blocked login emails for srmist domain, case-insensitively", () => {
    expect(isBlockedLoginEmail("  STUDENT@SRMIST.EDU.IN  ")).toBe(true);
  });

  it("does not block non-srm domains", () => {
    expect(isBlockedLoginEmail("founder@example.com")).toBe(false);
    expect(isBlockedLoginEmail("student@srmist.edu.in.example")).toBe(false);
  });

  it("does not block nullish or empty values", () => {
    expect(isBlockedLoginEmail(undefined)).toBe(false);
    expect(isBlockedLoginEmail(null)).toBe(false);
    expect(isBlockedLoginEmail("")).toBe(false);
  });

  it("exposes stable block metadata constants", () => {
    expect(BLOCKED_LOGIN_EMAIL_DOMAIN).toBe("@srmist.edu.in");
    expect(AUTH_ERROR_REASON_SRM_BLOCKED).toBe("srm-email-blocked");
  });
});
