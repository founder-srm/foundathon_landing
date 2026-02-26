import { SRM_EMAIL_DOMAIN } from "@/server/registration/constants";

export const BLOCKED_LOGIN_EMAIL_DOMAIN = SRM_EMAIL_DOMAIN;
export const AUTH_ERROR_REASON_SRM_BLOCKED = "srm-email-blocked";

const normalizeEmail = (email: string | null | undefined) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

export const isBlockedLoginEmail = (email: string | null | undefined) =>
  normalizeEmail(email).endsWith(BLOCKED_LOGIN_EMAIL_DOMAIN);
