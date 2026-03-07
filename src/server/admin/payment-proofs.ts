import { PROBLEM_STATEMENTS } from "@/data/problem-statements";
import {
  DEFAULT_PAYMENT_STATUS,
  normalizePaymentStatus,
  PAYMENT_PROOF_BUCKET_NAME,
  type PaymentStatus,
} from "@/lib/payments";
import { EVENT_ID, UUID_PATTERN } from "@/server/registration/constants";
import { getServiceRoleSupabaseClient } from "@/server/supabase/service-role-client";

type ServiceSuccess<T> = {
  data: T;
  ok: true;
  status: number;
};

type ServiceFailure = {
  error: string;
  ok: false;
  status: number;
};

type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

const ok = <T>(data: T, status = 200): ServiceSuccess<T> => ({
  data,
  ok: true,
  status,
});

const fail = (error: string, status: number): ServiceFailure => ({
  error,
  ok: false,
  status,
});

const REGISTRATION_TABLE = "eventsregistrations";
const PAYMENT_PROOF_SIGNED_URL_TTL_SECONDS = 60 * 5;

type AdminPaymentRow = {
  details?: unknown;
  id: string;
  is_approved?: string | null;
  registration_email?: string | null;
};

export type AdminPaymentStatementFilter =
  | "all"
  | (typeof PROBLEM_STATEMENTS)[number]["id"];

export type AdminPaymentProofTeam = {
  id: string;
  leadName: string;
  paymentRejectedReason: string | null;
  paymentReviewedAt: string | null;
  paymentStatus: PaymentStatus;
  paymentSubmittedAt: string | null;
  paymentUtr: string | null;
  problemStatementId: string | null;
  problemStatementTitle: string | null;
  registrationEmail: string;
  teamName: string;
};

export type ListAdminPaymentProofsPayload = {
  statement: AdminPaymentStatementFilter;
  teams: AdminPaymentProofTeam[];
};

export type UpdateAdminPaymentDecisionPayload = {
  paymentRejectedReason: string | null;
  paymentReviewedAt: string | null;
  paymentStatus: Extract<PaymentStatus, "approved" | "rejected">;
  teamId: string;
};

const statementTitleById = new Map(
  PROBLEM_STATEMENTS.map((statement) => [statement.id, statement.title]),
);

const toTrimmedString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const toDetailsRecord = (details: unknown): Record<string, unknown> =>
  details && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};

const toApprovalStatus = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const toLeadName = (details: Record<string, unknown>) => {
  const lead = details.lead;
  if (!lead || typeof lead !== "object" || Array.isArray(lead)) {
    return "Unknown Lead";
  }

  return (
    toTrimmedString((lead as Record<string, unknown>).name) ?? "Unknown Lead"
  );
};

const toTeamName = (details: Record<string, unknown>) =>
  toTrimmedString(details.teamName) ?? "Unnamed Team";

const toProblemStatementId = (details: Record<string, unknown>) =>
  toTrimmedString(details.problemStatementId)?.toLowerCase() ?? null;

const toProblemStatementTitle = (details: Record<string, unknown>) => {
  const stored = toTrimmedString(details.problemStatementTitle);
  if (stored) {
    return stored;
  }

  const statementId = toProblemStatementId(details);
  return statementId ? (statementTitleById.get(statementId) ?? null) : null;
};

const toPaymentStatus = (details: Record<string, unknown>) =>
  normalizePaymentStatus(details.paymentStatus) ?? DEFAULT_PAYMENT_STATUS;

const toAdminPaymentProofTeam = (
  row: AdminPaymentRow,
): AdminPaymentProofTeam | null => {
  if (toApprovalStatus(row.is_approved) !== "accepted") {
    return null;
  }

  const details = toDetailsRecord(row.details);
  return {
    id: row.id,
    leadName: toLeadName(details),
    paymentRejectedReason: toTrimmedString(details.paymentRejectedReason),
    paymentReviewedAt: toTrimmedString(details.paymentReviewedAt),
    paymentStatus: toPaymentStatus(details),
    paymentSubmittedAt: toTrimmedString(details.paymentSubmittedAt),
    paymentUtr: toTrimmedString(details.paymentUtr),
    problemStatementId: toProblemStatementId(details),
    problemStatementTitle: toProblemStatementTitle(details),
    registrationEmail: toTrimmedString(row.registration_email) ?? "",
    teamName: toTeamName(details),
  };
};

const sortPaymentTeams = (teams: AdminPaymentProofTeam[]) => {
  const rankByStatus: Record<PaymentStatus, number> = {
    approved: 3,
    not_submitted: 2,
    rejected: 1,
    submitted: 0,
  };

  return [...teams].sort((left, right) => {
    const rankDifference =
      rankByStatus[left.paymentStatus] - rankByStatus[right.paymentStatus];
    if (rankDifference !== 0) {
      return rankDifference;
    }

    const leftTs = Date.parse(left.paymentSubmittedAt ?? "");
    const rightTs = Date.parse(right.paymentSubmittedAt ?? "");
    if (!Number.isNaN(leftTs) && !Number.isNaN(rightTs) && leftTs !== rightTs) {
      return rightTs - leftTs;
    }

    return left.teamName.localeCompare(right.teamName);
  });
};

const getAdminPaymentProofRow = async (teamId: string) => {
  const supabase = getServiceRoleSupabaseClient();
  if (!supabase) {
    return {
      error: "Supabase service role client is not configured.",
      row: null,
    };
  }

  const { data, error } = await supabase
    .from(REGISTRATION_TABLE)
    .select("id, is_approved, registration_email, details")
    .eq("event_id", EVENT_ID)
    .eq("id", teamId)
    .maybeSingle();

  if (error) {
    return {
      error: error.message || "Failed to fetch payment proof row.",
      row: null,
    };
  }

  return { error: null, row: (data as AdminPaymentRow | null) ?? null };
};

export const listAdminPaymentProofs = async ({
  statement = "all",
}: {
  statement?: AdminPaymentStatementFilter;
}): Promise<ServiceResult<ListAdminPaymentProofsPayload>> => {
  const supabase = getServiceRoleSupabaseClient();
  if (!supabase) {
    return fail("Supabase service role client is not configured.", 500);
  }

  const { data, error } = await supabase
    .from(REGISTRATION_TABLE)
    .select("id, is_approved, registration_email, details")
    .eq("event_id", EVENT_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return fail(error.message || "Failed to load payment proofs.", 500);
  }

  const teams = ((data ?? []) as AdminPaymentRow[])
    .map((row) => toAdminPaymentProofTeam(row))
    .filter((team): team is AdminPaymentProofTeam => Boolean(team))
    .filter((team) =>
      statement === "all" ? true : team.problemStatementId === statement,
    );

  return ok({
    statement,
    teams: sortPaymentTeams(teams),
  });
};

export const updateAdminPaymentDecision = async ({
  decision,
  reason,
  teamId,
}: {
  decision: Extract<PaymentStatus, "approved" | "rejected">;
  reason?: string | null;
  teamId: string;
}): Promise<ServiceResult<UpdateAdminPaymentDecisionPayload>> => {
  if (!UUID_PATTERN.test(teamId)) {
    return fail("Team id is invalid.", 400);
  }

  const normalizedReason = toTrimmedString(reason);
  if (decision === "rejected" && !normalizedReason) {
    return fail("Rejection reason is required.", 400);
  }

  const supabase = getServiceRoleSupabaseClient();
  if (!supabase) {
    return fail("Supabase service role client is not configured.", 500);
  }

  const existingLookup = await getAdminPaymentProofRow(teamId);
  if (existingLookup.error) {
    return fail(existingLookup.error, 500);
  }

  const existing = existingLookup.row;
  if (!existing) {
    return fail("Team not found.", 404);
  }

  if (toApprovalStatus(existing.is_approved) !== "accepted") {
    return fail("Only accepted teams can be reviewed for payment.", 409);
  }

  const existingDetails = toDetailsRecord(existing.details);
  if (toPaymentStatus(existingDetails) !== "submitted") {
    return fail("Only submitted payment proofs can be reviewed.", 409);
  }

  const reviewedAt = new Date().toISOString();
  const nextDetails: Record<string, unknown> = {
    ...existingDetails,
    paymentReviewedAt: reviewedAt,
    paymentStatus: decision,
  };

  if (decision === "approved") {
    delete nextDetails.paymentRejectedReason;
  } else {
    nextDetails.paymentRejectedReason = normalizedReason;
  }

  const { data, error } = await supabase
    .from(REGISTRATION_TABLE)
    .update({ details: nextDetails })
    .eq("event_id", EVENT_ID)
    .eq("id", teamId)
    .select("id, details")
    .maybeSingle();

  if (error) {
    return fail(error.message || "Failed to update payment decision.", 500);
  }

  if (!data) {
    return fail("Team not found.", 404);
  }

  return ok({
    paymentRejectedReason:
      decision === "rejected" ? (normalizedReason ?? null) : null,
    paymentReviewedAt: reviewedAt,
    paymentStatus: decision,
    teamId,
  });
};

export const getAdminPaymentProofDownloadUrl = async ({
  teamId,
}: {
  teamId: string;
}): Promise<ServiceResult<{ url: string }>> => {
  if (!UUID_PATTERN.test(teamId)) {
    return fail("Team id is invalid.", 400);
  }

  const rowLookup = await getAdminPaymentProofRow(teamId);
  if (rowLookup.error) {
    return fail(rowLookup.error, 500);
  }

  const row = rowLookup.row;
  if (!row) {
    return fail("Team not found.", 404);
  }

  const details = toDetailsRecord(row.details);
  const storagePath = toTrimmedString(details.paymentProofStoragePath);
  if (!storagePath) {
    return fail("Payment proof not found.", 404);
  }

  const supabase = getServiceRoleSupabaseClient();
  if (!supabase?.storage?.from) {
    return fail("Payment proof storage is unavailable.", 500);
  }

  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOF_BUCKET_NAME)
    .createSignedUrl(storagePath, PAYMENT_PROOF_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return fail(error?.message || "Failed to open payment proof.", 500);
  }

  return ok({ url: data.signedUrl });
};
