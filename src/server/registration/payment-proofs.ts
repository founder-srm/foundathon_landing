import {
  buildPaymentProofStoragePath,
  DEFAULT_PAYMENT_STATUS,
  getPaymentProofExtension,
  getPaymentProofStoragePathsForCleanup,
  isPaymentProofExtensionAllowed,
  isPaymentProofFileSignatureAllowed,
  isPaymentProofMimeTypeAllowed,
  normalizePaymentStatus,
  PAYMENT_PROOF_BUCKET_NAME,
  PAYMENT_PROOF_MAX_FILE_SIZE_BYTES,
} from "@/lib/payments";
import { getProblemStatementIdFromDetails } from "@/lib/problem-statement-availability";
import {
  type RegistrationRow,
  toTeamRecord,
  UUID_PATTERN,
} from "@/lib/register-api";
import {
  findRegistrationByTeamIdForUser,
  updateRegistrationDetailsByTeamIdForUser,
} from "@/server/registration/repository";
import type { RouteSupabaseClient } from "@/server/supabase/route-client";
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

const PAYMENT_PROOF_SIGNED_URL_TTL_SECONDS = 60 * 5;

const getDetailsRecord = (details: unknown) =>
  details && typeof details === "object"
    ? (details as Record<string, unknown>)
    : {};

const toTrimmedString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "";

const isAcceptedApprovalStatus = (value: unknown) =>
  typeof value === "string" && value.trim().toLowerCase() === "accepted";

const isRlsViolationError = (message: string | undefined) =>
  typeof message === "string" &&
  message.toLowerCase().includes("row-level security policy");

const isStorageObjectMissingError = (message: string | undefined) =>
  typeof message === "string" &&
  /not found|404|object does not exist|resource was not found/i.test(message);

const getStorageSupabaseClient = (supabase: RouteSupabaseClient) =>
  getServiceRoleSupabaseClient() ?? supabase;

const getPaymentStatus = (details: Record<string, unknown>) =>
  normalizePaymentStatus(details.paymentStatus) ?? DEFAULT_PAYMENT_STATUS;

const validatePaymentUtr = (utr: string) => {
  const normalized = utr.trim();
  if (normalized.length < 6 || normalized.length > 64) {
    return null;
  }

  return normalized;
};

export const submitTeamPaymentProof = async ({
  input,
  supabase,
  userId,
}: {
  input: { file: File; teamId: string; utr: string };
  supabase: RouteSupabaseClient;
  userId: string;
}): Promise<
  ServiceResult<{ team: NonNullable<ReturnType<typeof toTeamRecord>> }>
> => {
  if (!UUID_PATTERN.test(input.teamId)) {
    return fail("Team id is invalid.", 400);
  }

  const normalizedUtr = validatePaymentUtr(input.utr);
  if (!normalizedUtr) {
    return fail(
      "Transaction ID / UTR must be between 6 and 64 characters.",
      400,
    );
  }

  const file = input.file;
  const fileName = file.name.trim();
  if (!fileName) {
    return fail("Payment proof file is required.", 400);
  }

  if (file.size <= 0) {
    return fail("Payment proof file is empty.", 400);
  }

  if (file.size > PAYMENT_PROOF_MAX_FILE_SIZE_BYTES) {
    return fail("Payment proof file size must be 5 MB or less.", 400);
  }

  if (!isPaymentProofExtensionAllowed(fileName)) {
    return fail("Only PNG, JPG, WEBP, or PDF payment proofs are allowed.", 400);
  }

  const extension = getPaymentProofExtension(fileName);
  const hasValidSignature = await isPaymentProofFileSignatureAllowed(
    file,
    extension,
  );
  if (!hasValidSignature) {
    return fail("Invalid payment proof file signature.", 400);
  }

  if (file.type && !isPaymentProofMimeTypeAllowed(file.type)) {
    return fail("Invalid payment proof file type.", 400);
  }

  const { data: existingTeam, error: existingTeamError } =
    await findRegistrationByTeamIdForUser(supabase, input.teamId, userId);

  if (existingTeamError) {
    return fail(existingTeamError.message || "Failed to fetch team.", 500);
  }

  if (!existingTeam) {
    return fail("Team not found.", 404);
  }

  if (!isAcceptedApprovalStatus(existingTeam.is_approved)) {
    return fail("Only accepted teams can submit payment proof.", 409);
  }

  const existingDetails = getDetailsRecord(existingTeam.details);
  const existingStatementId = getProblemStatementIdFromDetails(existingDetails);
  if (!existingStatementId) {
    return fail(
      "Lock a problem statement before submitting payment proof.",
      409,
    );
  }

  const paymentStatus = getPaymentStatus(existingDetails);
  if (paymentStatus === "approved") {
    return fail("Payment is already approved for this team.", 409);
  }

  if (paymentStatus === "submitted") {
    return fail("Payment proof is already under review.", 409);
  }

  const storageClient = getStorageSupabaseClient(supabase);
  if (!storageClient.storage?.from) {
    return fail("Payment proof storage is unavailable.", 500);
  }

  const existingStoragePath = toTrimmedString(
    existingDetails.paymentProofStoragePath,
  );
  const pathsToCleanup = getPaymentProofStoragePathsForCleanup({
    directPath: existingStoragePath,
    teamId: input.teamId,
    userId,
  });

  if (pathsToCleanup.length > 0) {
    const { error: removeError } = await storageClient.storage
      .from(PAYMENT_PROOF_BUCKET_NAME)
      .remove(pathsToCleanup);

    if (removeError && !isStorageObjectMissingError(removeError.message)) {
      if (isRlsViolationError(removeError.message)) {
        return fail(
          `Payment proof upload is blocked by Supabase Storage policy. Please ask an admin to allow authenticated uploads to the ${PAYMENT_PROOF_BUCKET_NAME} bucket.`,
          500,
        );
      }

      return fail(
        removeError.message || "Failed to replace payment proof.",
        500,
      );
    }
  }

  const storagePath = buildPaymentProofStoragePath({
    extension,
    teamId: input.teamId,
    userId,
  });

  const { error: uploadError } = await storageClient.storage
    .from(PAYMENT_PROOF_BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: true,
    });

  if (uploadError) {
    if (isRlsViolationError(uploadError.message)) {
      return fail(
        `Payment proof upload is blocked by Supabase Storage policy. Please ask an admin to allow authenticated uploads to the ${PAYMENT_PROOF_BUCKET_NAME} bucket.`,
        500,
      );
    }

    return fail(uploadError.message || "Failed to upload payment proof.", 500);
  }

  const updatedDetails: Record<string, unknown> = {
    ...existingDetails,
    paymentProofFileName: fileName,
    paymentProofFileSizeBytes: file.size,
    paymentProofMimeType: file.type || "application/octet-stream",
    paymentProofStoragePath: storagePath,
    paymentStatus: "submitted",
    paymentSubmittedAt: new Date().toISOString(),
    paymentUtr: normalizedUtr,
  };

  delete updatedDetails.paymentRejectedReason;
  delete updatedDetails.paymentReviewedAt;

  const { data, error } = await updateRegistrationDetailsByTeamIdForUser({
    details: updatedDetails,
    supabase,
    teamId: input.teamId,
    userId,
  });

  if (error || !data) {
    await storageClient.storage
      .from(PAYMENT_PROOF_BUCKET_NAME)
      .remove([storagePath])
      .catch(() => undefined);
    return fail(error?.message || "Failed to save payment proof details.", 500);
  }

  const team = toTeamRecord(data as RegistrationRow);
  if (!team) {
    return fail("Team data is incomplete or outdated.", 422);
  }

  return ok({ team });
};

export const getTeamPaymentProofDownloadUrl = async ({
  supabase,
  teamId,
  userId,
}: {
  supabase: RouteSupabaseClient;
  teamId: string;
  userId: string;
}): Promise<ServiceResult<{ url: string }>> => {
  if (!UUID_PATTERN.test(teamId)) {
    return fail("Team id is invalid.", 400);
  }

  const { data: existingTeam, error } = await findRegistrationByTeamIdForUser(
    supabase,
    teamId,
    userId,
  );

  if (error) {
    return fail(error.message || "Failed to fetch team.", 500);
  }

  if (!existingTeam) {
    return fail("Team not found.", 404);
  }

  const details = getDetailsRecord(existingTeam.details);
  const storagePath = toTrimmedString(details.paymentProofStoragePath);
  if (!storagePath) {
    return fail("Payment proof not found.", 404);
  }

  const storageClient = getStorageSupabaseClient(supabase);
  if (!storageClient.storage?.from) {
    return fail("Payment proof storage is unavailable.", 500);
  }

  const { data, error: signedUrlError } = await storageClient.storage
    .from(PAYMENT_PROOF_BUCKET_NAME)
    .createSignedUrl(storagePath, PAYMENT_PROOF_SIGNED_URL_TTL_SECONDS);

  if (signedUrlError || !data?.signedUrl) {
    if (isStorageObjectMissingError(signedUrlError?.message)) {
      return fail("Payment proof not found.", 404);
    }

    return fail(
      signedUrlError?.message || "Failed to open payment proof.",
      500,
    );
  }

  return ok({ url: data.signedUrl });
};
