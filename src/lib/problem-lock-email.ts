export const LOCK_EMAIL_SUMMARY_FALLBACK = "Summary unavailable.";
export const SRM_EMAIL_DOMAIN = "@srmist.edu.in";

type ProblemLockEmailBasePayload = {
  leadEmail: string;
  leadName: string;
  lockExpiresAtIso: string;
  lockedAtIso: string;
  problemStatementId: string;
  problemStatementSummary: string;
  problemStatementTitle: string;
  teamName: string;
};

export type ProblemLockEmailPayload =
  | (ProblemLockEmailBasePayload & {
      notificationType: "lock_confirmed";
    })
  | (ProblemLockEmailBasePayload & {
      abandonedAtIso: string;
      notificationType: "lock_abandoned";
    });

export type ProblemLockEmailResponse = {
  error?: string;
  reason?: string;
  sent: boolean;
};

type StatementSummarySource = {
  id: string;
  summary: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const toSrmLeadEmail = (netId: string) => {
  const normalized = netId.trim().toLowerCase();
  if (!normalized) return "";
  return normalized.endsWith(SRM_EMAIL_DOMAIN)
    ? normalized
    : `${normalized}${SRM_EMAIL_DOMAIN}`;
};

export const isValidEmailAddress = (value: string) =>
  EMAIL_PATTERN.test(value.trim().toLowerCase());

export const findProblemStatementSummary = (
  statements: StatementSummarySource[],
  statementId: string,
) =>
  statements.find((statement) => statement.id === statementId)?.summary ??
  LOCK_EMAIL_SUMMARY_FALLBACK;
