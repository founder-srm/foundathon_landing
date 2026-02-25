import {
  type TeamApprovalStatus,
  type TeamRecord,
  type TeamSubmission,
  teamSubmissionSchema,
} from "@/lib/register-schema";
import { SRM_EMAIL_DOMAIN } from "@/server/registration/constants";

export type TeamSummary = {
  id: string;
  teamName: string;
  teamType: "srm" | "non_srm";
  leadName: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RegistrationRow = {
  id: string;
  created_at: string;
  is_approved?: string | null;
  updated_at?: string | null;
  details: Record<string, unknown> | null;
};

const toSrmLocalNetId = (netId: string) => {
  const normalized = netId.trim().toLowerCase();
  return normalized.endsWith(SRM_EMAIL_DOMAIN)
    ? normalized.slice(0, -SRM_EMAIL_DOMAIN.length)
    : normalized;
};

export const toSrmEmailNetId = (netId: string) => {
  const normalized = netId.trim().toLowerCase();
  return normalized.endsWith(SRM_EMAIL_DOMAIN)
    ? normalized
    : `${normalized}${SRM_EMAIL_DOMAIN}`;
};

const normalizeSrmDetailsForSchema = (details: Record<string, unknown>) => {
  if (details.teamType !== "srm") {
    return details;
  }

  const lead =
    details.lead && typeof details.lead === "object"
      ? (details.lead as Record<string, unknown>)
      : null;
  const members = Array.isArray(details.members) ? details.members : [];

  return {
    ...details,
    lead: lead
      ? {
          ...lead,
          netId:
            typeof lead.netId === "string"
              ? toSrmLocalNetId(lead.netId)
              : lead.netId,
        }
      : details.lead,
    members: members.map((member) => {
      if (!member || typeof member !== "object") {
        return member;
      }

      const srmMember = member as Record<string, unknown>;
      return {
        ...srmMember,
        netId:
          typeof srmMember.netId === "string"
            ? toSrmLocalNetId(srmMember.netId)
            : srmMember.netId,
      };
    }),
  };
};

export const withSrmEmailNetIds = (
  submission: TeamSubmission,
): TeamSubmission =>
  submission.teamType === "srm"
    ? {
        ...submission,
        lead: {
          ...submission.lead,
          netId: toSrmEmailNetId(submission.lead.netId),
        },
        members: submission.members.map((member) => ({
          ...member,
          netId: toSrmEmailNetId(member.netId),
        })),
      }
    : submission;

export function toTeamSummary(row: RegistrationRow): TeamSummary {
  const details = row.details ?? {};
  const normalized = normalizeSrmDetailsForSchema(details);
  const parsed = teamSubmissionSchema.safeParse(normalized);

  if (!parsed.success) {
    return {
      id: row.id,
      teamName: "Unnamed Team",
      teamType: "srm",
      leadName: "Unknown Lead",
      memberCount: 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
    };
  }

  const submission = parsed.data;
  return {
    id: row.id,
    teamName: submission.teamName,
    teamType: submission.teamType,
    leadName: submission.lead.name,
    memberCount: submission.members.length + 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

const toOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const toOptionalPositiveInteger = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;

const toOptionalApprovalStatus = (
  value: unknown,
): TeamApprovalStatus | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "accepted":
    case "invalid":
    case "rejected":
    case "submitted":
      return normalized;
    default:
      return undefined;
  }
};

export function toTeamRecord(row: RegistrationRow): TeamRecord | null {
  const details = row.details ?? {};
  const normalized = normalizeSrmDetailsForSchema(details);
  const parsed = teamSubmissionSchema.safeParse(normalized);

  if (!parsed.success) {
    return null;
  }

  const problemStatementId = toOptionalString(details.problemStatementId);
  const problemStatementTitle = toOptionalString(details.problemStatementTitle);
  const problemStatementLockedAt = toOptionalString(
    details.problemStatementLockedAt,
  );
  const problemStatementCap = toOptionalPositiveInteger(
    details.problemStatementCap,
  );
  const presentationPublicUrl = toOptionalString(details.presentationPublicUrl);
  const presentationStoragePath = toOptionalString(
    details.presentationStoragePath,
  );
  const presentationUploadedAt = toOptionalString(
    details.presentationUploadedAt,
  );
  const presentationFileName = toOptionalString(details.presentationFileName);
  const presentationMimeType = toOptionalString(details.presentationMimeType);
  const presentationFileSizeBytes = toOptionalPositiveInteger(
    details.presentationFileSizeBytes,
  );
  const approvalStatus = toOptionalApprovalStatus(row.is_approved);

  return {
    ...parsed.data,
    ...(approvalStatus ? { approvalStatus } : {}),
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    ...(problemStatementId ? { problemStatementId } : {}),
    ...(problemStatementTitle ? { problemStatementTitle } : {}),
    ...(problemStatementLockedAt ? { problemStatementLockedAt } : {}),
    ...(problemStatementCap ? { problemStatementCap } : {}),
    ...(presentationPublicUrl ? { presentationPublicUrl } : {}),
    ...(presentationStoragePath ? { presentationStoragePath } : {}),
    ...(presentationUploadedAt ? { presentationUploadedAt } : {}),
    ...(presentationFileName ? { presentationFileName } : {}),
    ...(presentationMimeType ? { presentationMimeType } : {}),
    ...(presentationFileSizeBytes ? { presentationFileSizeBytes } : {}),
  };
}
