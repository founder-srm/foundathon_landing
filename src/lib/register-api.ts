import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  type TeamRecord,
  type TeamSubmission,
  teamSubmissionSchema,
} from "@/lib/register-schema";

export const JSON_HEADERS = { "Cache-Control": "no-store" };
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const EVENT_ID = "583a3b40-da9d-412a-a266-cc7e64330b16";
export const EVENT_TITLE = "Foundathon 3.0";
export const SRM_EMAIL_DOMAIN = "@srmist.edu.in";

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
  updated_at: string | null;
  details: Record<string, unknown> | null;
};

type SupabaseCredentials = {
  anonKey: string;
  url: string;
};

export function getSupabaseCredentials(): SupabaseCredentials | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { anonKey, url };
}

export async function createSupabaseClient({
  anonKey,
  url,
}: SupabaseCredentials) {
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, options, value }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

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

  return {
    ...parsed.data,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    ...(problemStatementId ? { problemStatementId } : {}),
    ...(problemStatementTitle ? { problemStatementTitle } : {}),
    ...(problemStatementLockedAt ? { problemStatementLockedAt } : {}),
    ...(problemStatementCap ? { problemStatementCap } : {}),
  };
}
