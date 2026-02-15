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

const getTeamSubmissionFromDetails = (
  details: Record<string, unknown>,
): TeamSubmission | null => {
  const parsed = teamSubmissionSchema.safeParse(details.payload);
  if (!parsed.success) return null;
  return parsed.data;
};

const getRollNumber = (
  member:
    | TeamSubmission["lead"]
    | TeamSubmission["members"][number]
    | undefined,
): string | null => {
  if (!member) return null;
  return "raNumber" in member ? member.raNumber : member.collegeId;
};

const getDepartment = (
  member:
    | TeamSubmission["lead"]
    | TeamSubmission["members"][number]
    | undefined,
): string | null => {
  if (!member || !("dept" in member)) return null;
  return member.dept;
};

export function transformToLegacyFormat(
  submission: TeamSubmission,
): Record<string, unknown> {
  const allMembers = [submission.lead, ...submission.members];
  const [lead, second, third, fourth, fifth] = allMembers;

  return {
    teamType: submission.teamType,
    teamName: submission.teamName,
    collegeName:
      submission.teamType === "non_srm" ? submission.collegeName : null,
    isClub: submission.teamType === "non_srm" ? submission.isClub : null,
    clubName: submission.teamType === "non_srm" ? submission.clubName : null,

    fullName1: lead?.name ?? null,
    rollNumber1: getRollNumber(lead),
    dept1: getDepartment(lead),

    fullName2: second?.name ?? null,
    rollNumber2: getRollNumber(second),
    dept2: getDepartment(second),

    fullName3: third?.name ?? null,
    rollNumber3: getRollNumber(third),
    dept3: getDepartment(third),

    fullName4: fourth?.name ?? null,
    rollNumber4: getRollNumber(fourth),
    dept4: getDepartment(fourth),

    fullName5: fifth?.name ?? null,
    rollNumber5: getRollNumber(fifth),
    dept5: getDepartment(fifth),

    whatsAppNumber: submission.lead.contact ?? null,
    paymentAgreement: true,

    // Canonical payload used by dashboard edit flows.
    payload: submission,
  };
}

export function toTeamSummary(row: RegistrationRow): TeamSummary {
  const details = row.details ?? {};
  const submission = getTeamSubmissionFromDetails(details);

  if (submission) {
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

  const fullNames = [
    details.fullName1,
    details.fullName2,
    details.fullName3,
    details.fullName4,
    details.fullName5,
  ];

  const memberCount = fullNames.filter(
    (name) => typeof name === "string" && name.trim().length > 0,
  ).length;

  return {
    id: row.id,
    teamName:
      typeof details.teamName === "string" && details.teamName.trim().length > 0
        ? details.teamName
        : "Unnamed Team",
    teamType: details.teamType === "non_srm" ? "non_srm" : "srm",
    leadName:
      typeof details.fullName1 === "string" &&
      details.fullName1.trim().length > 0
        ? details.fullName1
        : "Unknown Lead",
    memberCount: Math.max(memberCount, 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export function toTeamRecord(row: RegistrationRow): TeamRecord | null {
  const details = row.details ?? {};
  const submission = getTeamSubmissionFromDetails(details);
  const fallbackSubmission = getFallbackSubmissionFromLegacy(details, row.id);
  const resolvedSubmission = submission ?? fallbackSubmission;
  if (!resolvedSubmission) return null;

  return {
    ...resolvedSubmission,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

const DEFAULT_LEGACY_CONTACT = 9_000_000_000;

const asTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const asValidContact = (value: unknown, fallback: number): number => {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1_000_000_000 &&
    value <= 9_999_999_999
  ) {
    return value;
  }
  return fallback;
};

const fallbackNetId = (index: number): string =>
  `aa${String(index).padStart(4, "0")}`;

const fallbackCollegeEmail = (rowId: string, index: number): string =>
  `member${index}.${rowId.slice(0, 8)}@example.com`;

function getFallbackSubmissionFromLegacy(
  details: Record<string, unknown>,
  rowId: string,
): TeamSubmission | null {
  const slots = [1, 2, 3, 4, 5].map((slot) => ({
    dept: asTrimmedString(details[`dept${slot}`]),
    name: asTrimmedString(details[`fullName${slot}`]),
    rollNumber: asTrimmedString(details[`rollNumber${slot}`]),
    slot,
  }));

  const filledSlots = slots.filter((slot) => slot.name.length > 0);
  if (filledSlots.length < 3) {
    return null;
  }

  const teamName = asTrimmedString(details.teamName) || "Unnamed Team";
  const leadSlot = filledSlots[0];
  if (!leadSlot) return null;

  const memberSlots = filledSlots.slice(1);
  const inferredTeamType =
    details.teamType === "non_srm"
      ? "non_srm"
      : slots.some((slot) => slot.dept.length > 0)
        ? "srm"
        : "non_srm";

  if (inferredTeamType === "srm") {
    const lead = {
      contact: asValidContact(details.whatsAppNumber, DEFAULT_LEGACY_CONTACT),
      dept: leadSlot.dept || "NA",
      name: leadSlot.name,
      netId: fallbackNetId(leadSlot.slot - 1),
      raNumber: leadSlot.rollNumber || `RA${"0".repeat(13)}`,
    };

    const members = memberSlots.map((slot, index) => ({
      contact: asValidContact(
        details[`contact${slot.slot}`],
        DEFAULT_LEGACY_CONTACT + index + 1,
      ),
      dept: slot.dept || "NA",
      name: slot.name,
      netId: fallbackNetId(slot.slot - 1),
      raNumber: slot.rollNumber || `RA${String(index + 1).padStart(13, "0")}`,
    }));

    const parsed = teamSubmissionSchema.safeParse({
      lead,
      members,
      teamName,
      teamType: "srm",
    });
    return parsed.success ? parsed.data : null;
  }

  const lead = {
    collegeEmail: fallbackCollegeEmail(rowId, 1),
    collegeId: leadSlot.rollNumber || `ID-${rowId.slice(0, 6)}`,
    contact: asValidContact(details.whatsAppNumber, DEFAULT_LEGACY_CONTACT),
    name: leadSlot.name,
  };

  const members = memberSlots.map((slot, index) => ({
    collegeEmail: fallbackCollegeEmail(rowId, slot.slot),
    collegeId: slot.rollNumber || `ID-${slot.slot}-${rowId.slice(0, 4)}`,
    contact: asValidContact(
      details[`contact${slot.slot}`],
      DEFAULT_LEGACY_CONTACT + index + 1,
    ),
    name: slot.name,
  }));

  const parsed = teamSubmissionSchema.safeParse({
    clubName: asTrimmedString(details.clubName),
    collegeName: asTrimmedString(details.collegeName) || "Unknown College",
    isClub: details.isClub === true,
    lead,
    members,
    teamName,
    teamType: "non_srm",
  });
  return parsed.success ? parsed.data : null;
}
