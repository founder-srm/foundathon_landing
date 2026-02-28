import {
  PROBLEM_STATEMENT_CAP,
  PROBLEM_STATEMENTS,
} from "@/data/problem-statements";
import {
  EVENT_ID,
  EVENT_TITLE,
  type RegistrationRow,
} from "@/lib/register-api";
import { getFoundathonStatsExcludedEmails } from "@/server/env";
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

export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

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

type StatementStats = {
  cap: number;
  fillRatePercent: number;
  isFull: boolean;
  problemStatementId: string;
  registeredTeams: number;
  remainingTeams: number;
  title: string;
};

type TeamType = "non_srm" | "srm" | "unknown";

type TeamTypeBreakdown = {
  percent: number;
  teamType: TeamType;
  teams: number;
};

type ApprovalStatus =
  | "accepted"
  | "invalid"
  | "not_reviewed"
  | "rejected"
  | "submitted";

type ApprovalStatusBreakdown = {
  percent: number;
  status: ApprovalStatus;
  teams: number;
};

const TEAM_TYPE_ORDER: TeamType[] = ["srm", "non_srm", "unknown"];
const APPROVAL_STATUS_ORDER: ApprovalStatus[] = [
  "accepted",
  "rejected",
  "submitted",
  "invalid",
  "not_reviewed",
];

type RegistrationTrendEntry = {
  date: string;
  registrations: number;
};

type RegistrationStatsResponse = {
  additionalStats: {
    anomalies: {
      missingOrInvalidTeamMembers: number;
      missingOrInvalidTeamType: number;
      missingProblemStatementId: number;
      unknownProblemStatementId: number;
    };
    approvalStatusBreakdown: ApprovalStatusBreakdown[];
    firstRegistrationAt: string | null;
    lastRegistrationAt: string | null;
    participation: {
      averageTeamSize: number;
      totalParticipants: number;
    };
    presentationSubmission: {
      pendingTeams: number;
      submissionRatePercent: number;
      submittedTeams: number;
    };
    registrationTrendByDate: RegistrationTrendEntry[];
    teamTypeBreakdown: TeamTypeBreakdown[];
  };
  event: {
    eventId: string;
    eventTitle: string;
    statementCap: number;
    totalCapacity: number;
    totalStatements: number;
  };
  filters: {
    excludedRegistrationEmails: string[];
    excludedRows: number;
    includedRows: number;
  };
  generatedAt: string;
  requiredStats: {
    rateOfFilling: {
      capacityTeams: number;
      filledTeams: number;
      overallPercent: number;
      remainingTeams: number;
    };
    registrationsPerProblemStatement: StatementStats[];
    totalTeamsRegistered: number;
  };
  visualData: {
    cards: Array<{
      id:
        | "avgTeamSize"
        | "overallFillRate"
        | "pptSubmissionRate"
        | "totalParticipants"
        | "totalTeamsRegistered";
      label: string;
      unit: "members_per_team" | "participants" | "percent" | "teams";
      value: number;
    }>;
    charts: {
      approvalStatusDistribution: {
        chartType: "donut";
        labels: string[];
        series: Array<{ data: number[]; name: "Teams" }>;
      };
      fillRatePerProblemStatement: {
        chartType: "bar";
        labels: string[];
        series: Array<{ data: number[]; name: "Fill Rate %" }>;
      };
      registrationTrendByDate: {
        chartType: "line";
        labels: string[];
        series: Array<{ data: number[]; name: "Registrations" }>;
      };
      registrationsPerProblemStatement: {
        chartType: "bar";
        labels: string[];
        series: Array<{
          data: number[];
          name: "Capacity" | "Registrations";
        }>;
      };
      teamTypeDistribution: {
        chartType: "donut";
        labels: string[];
        series: Array<{ data: number[]; name: "Teams" }>;
      };
    };
  };
};

type StatsRegistrationRow = RegistrationRow & {
  is_approved?: string | null;
  registration_email?: string | null;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeEmail = (email: string | null | undefined) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const normalizeTeamType = (value: unknown): TeamType => {
  if (value === "srm" || value === "non_srm") {
    return value;
  }

  return "unknown";
};

const normalizeApprovalStatus = (value: string | null | undefined) => {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  switch (normalized) {
    case "accepted":
    case "invalid":
    case "rejected":
    case "submitted":
      return normalized;
    default:
      return "not_reviewed";
  }
};

const roundToTwo = (value: number) =>
  Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

const toDetails = (details: unknown): Record<string, unknown> =>
  isObjectRecord(details) ? details : {};

const getProblemStatementId = (details: Record<string, unknown>) => {
  const value = details.problemStatementId;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
};

const hasPresentationData = (details: Record<string, unknown>) => {
  const textFields = [
    details.presentationPublicUrl,
    details.presentationStoragePath,
    details.presentationUploadedAt,
    details.presentationFileName,
    details.presentationMimeType,
  ];

  if (
    textFields.some(
      (value) => typeof value === "string" && value.trim().length > 0,
    )
  ) {
    return true;
  }

  return (
    typeof details.presentationFileSizeBytes === "number" &&
    Number.isInteger(details.presentationFileSizeBytes) &&
    details.presentationFileSizeBytes > 0
  );
};

const getParticipantsCountAndValidity = (details: Record<string, unknown>) => {
  const lead = details.lead;
  const members = details.members;

  if (!isObjectRecord(lead) || !Array.isArray(members)) {
    return {
      hasInvalidTeamMembers: true,
      participants: 0,
    };
  }

  const validMembers = members.filter((member) => isObjectRecord(member));
  const hasInvalidTeamMembers = validMembers.length !== members.length;

  return {
    hasInvalidTeamMembers,
    participants: 1 + validMembers.length,
  };
};

const getUtcDateString = (input: string) => {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
};

const formatSupabaseStatsError = (error: {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string;
}) => {
  const segments = [
    typeof error.code === "string" ? `code=${error.code}` : null,
    typeof error.message === "string" && error.message.trim().length > 0
      ? `message=${error.message}`
      : null,
    typeof error.details === "string" && error.details.trim().length > 0
      ? `details=${error.details}`
      : null,
    typeof error.hint === "string" && error.hint.trim().length > 0
      ? `hint=${error.hint}`
      : null,
  ].filter((segment): segment is string => Boolean(segment));

  return segments.length > 0 ? ` ${segments.join(" | ")}` : "";
};

export const getRegistrationStats = async (): Promise<
  ServiceResult<RegistrationStatsResponse>
> => {
  const supabase = getServiceRoleSupabaseClient();
  if (!supabase) {
    return fail("Stats service role client is not configured.", 500);
  }

  const { data, error } = await supabase
    .from("eventsregistrations")
    .select("id, created_at, is_approved, registration_email, details")
    .eq("event_id", EVENT_ID);

  if (error) {
    return fail(
      `Failed to fetch registrations for stats.${formatSupabaseStatsError(
        error,
      )}`,
      500,
    );
  }

  const rows = ((data ?? []) as StatsRegistrationRow[]).filter(
    (row): row is StatsRegistrationRow => Boolean(row),
  );

  const excludedEmails = getFoundathonStatsExcludedEmails();
  const excludedEmailSet = new Set(excludedEmails);

  const includedRows: StatsRegistrationRow[] = [];
  let excludedRows = 0;

  for (const row of rows) {
    const normalizedRegistrationEmail = normalizeEmail(row.registration_email);
    if (
      normalizedRegistrationEmail &&
      excludedEmailSet.has(normalizedRegistrationEmail)
    ) {
      excludedRows += 1;
      continue;
    }

    includedRows.push(row);
  }

  const statementIdSet = new Set(PROBLEM_STATEMENTS.map((item) => item.id));
  const statementCounts = new Map<string, number>();
  const teamTypeCounts: Record<TeamType, number> = {
    non_srm: 0,
    srm: 0,
    unknown: 0,
  };
  const approvalStatusCounts: Record<ApprovalStatus, number> = {
    accepted: 0,
    invalid: 0,
    not_reviewed: 0,
    rejected: 0,
    submitted: 0,
  };
  const trendCounts = new Map<string, number>();

  let missingProblemStatementId = 0;
  let unknownProblemStatementId = 0;
  let missingOrInvalidTeamType = 0;
  let missingOrInvalidTeamMembers = 0;
  let totalParticipants = 0;
  let submittedTeams = 0;
  let earliestRegistrationTimestamp: number | null = null;
  let latestRegistrationTimestamp: number | null = null;

  for (const row of includedRows) {
    const details = toDetails(row.details);

    const statementId = getProblemStatementId(details);
    if (!statementId) {
      missingProblemStatementId += 1;
    } else if (!statementIdSet.has(statementId)) {
      unknownProblemStatementId += 1;
    } else {
      statementCounts.set(
        statementId,
        (statementCounts.get(statementId) ?? 0) + 1,
      );
    }

    const teamType = normalizeTeamType(details.teamType);
    teamTypeCounts[teamType] += 1;
    if (teamType === "unknown") {
      missingOrInvalidTeamType += 1;
    }

    const approvalStatus = normalizeApprovalStatus(row.is_approved);
    approvalStatusCounts[approvalStatus] += 1;

    if (hasPresentationData(details)) {
      submittedTeams += 1;
    }

    const participantsResult = getParticipantsCountAndValidity(details);
    totalParticipants += participantsResult.participants;
    if (participantsResult.hasInvalidTeamMembers) {
      missingOrInvalidTeamMembers += 1;
    }

    const createdTimestamp = new Date(row.created_at).valueOf();
    if (!Number.isNaN(createdTimestamp)) {
      if (
        earliestRegistrationTimestamp === null ||
        createdTimestamp < earliestRegistrationTimestamp
      ) {
        earliestRegistrationTimestamp = createdTimestamp;
      }

      if (
        latestRegistrationTimestamp === null ||
        createdTimestamp > latestRegistrationTimestamp
      ) {
        latestRegistrationTimestamp = createdTimestamp;
      }
    }

    const trendDate = getUtcDateString(row.created_at);
    if (trendDate) {
      trendCounts.set(trendDate, (trendCounts.get(trendDate) ?? 0) + 1);
    }
  }

  const registrationsPerProblemStatement: StatementStats[] =
    PROBLEM_STATEMENTS.map((statement) => {
      const registeredTeams = statementCounts.get(statement.id) ?? 0;
      const remainingTeams = Math.max(
        PROBLEM_STATEMENT_CAP - registeredTeams,
        0,
      );
      const fillRatePercent = roundToTwo(
        (registeredTeams / PROBLEM_STATEMENT_CAP) * 100,
      );

      return {
        cap: PROBLEM_STATEMENT_CAP,
        fillRatePercent,
        isFull: registeredTeams >= PROBLEM_STATEMENT_CAP,
        problemStatementId: statement.id,
        registeredTeams,
        remainingTeams,
        title: statement.title,
      };
    });

  const capacityTeams = PROBLEM_STATEMENT_CAP * PROBLEM_STATEMENTS.length;
  const filledTeams = registrationsPerProblemStatement.reduce(
    (total, item) => total + item.registeredTeams,
    0,
  );
  const remainingTeams = Math.max(capacityTeams - filledTeams, 0);
  const overallPercent = roundToTwo((filledTeams / capacityTeams) * 100);
  const totalTeamsRegistered = includedRows.length;

  const teamTypeBreakdown: TeamTypeBreakdown[] = TEAM_TYPE_ORDER.map(
    (teamType) => {
      const teams = teamTypeCounts[teamType];
      return {
        percent:
          totalTeamsRegistered > 0
            ? roundToTwo((teams / totalTeamsRegistered) * 100)
            : 0,
        teamType,
        teams,
      };
    },
  );

  const approvalStatusBreakdown: ApprovalStatusBreakdown[] =
    APPROVAL_STATUS_ORDER.map((status) => {
      const teams = approvalStatusCounts[status];
      return {
        percent:
          totalTeamsRegistered > 0
            ? roundToTwo((teams / totalTeamsRegistered) * 100)
            : 0,
        status,
        teams,
      };
    });

  const registrationTrendByDate = [...trendCounts.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, registrations]) => ({
      date,
      registrations,
    }));

  const pendingTeams = totalTeamsRegistered - submittedTeams;
  const submissionRatePercent =
    totalTeamsRegistered > 0
      ? roundToTwo((submittedTeams / totalTeamsRegistered) * 100)
      : 0;

  const averageTeamSize =
    totalTeamsRegistered > 0
      ? roundToTwo(totalParticipants / totalTeamsRegistered)
      : 0;

  const labelsByStatement = registrationsPerProblemStatement.map(
    (item) => item.title,
  );

  return ok({
    additionalStats: {
      anomalies: {
        missingOrInvalidTeamMembers,
        missingOrInvalidTeamType,
        missingProblemStatementId,
        unknownProblemStatementId,
      },
      approvalStatusBreakdown,
      firstRegistrationAt:
        earliestRegistrationTimestamp === null
          ? null
          : new Date(earliestRegistrationTimestamp).toISOString(),
      lastRegistrationAt:
        latestRegistrationTimestamp === null
          ? null
          : new Date(latestRegistrationTimestamp).toISOString(),
      participation: {
        averageTeamSize,
        totalParticipants,
      },
      presentationSubmission: {
        pendingTeams,
        submissionRatePercent,
        submittedTeams,
      },
      registrationTrendByDate,
      teamTypeBreakdown,
    },
    event: {
      eventId: EVENT_ID,
      eventTitle: EVENT_TITLE,
      statementCap: PROBLEM_STATEMENT_CAP,
      totalCapacity: capacityTeams,
      totalStatements: PROBLEM_STATEMENTS.length,
    },
    filters: {
      excludedRegistrationEmails: excludedEmails,
      excludedRows,
      includedRows: totalTeamsRegistered,
    },
    generatedAt: new Date().toISOString(),
    requiredStats: {
      rateOfFilling: {
        capacityTeams,
        filledTeams,
        overallPercent,
        remainingTeams,
      },
      registrationsPerProblemStatement,
      totalTeamsRegistered,
    },
    visualData: {
      cards: [
        {
          id: "totalTeamsRegistered",
          label: "Total Teams Registered",
          unit: "teams",
          value: totalTeamsRegistered,
        },
        {
          id: "overallFillRate",
          label: "Overall Fill Rate",
          unit: "percent",
          value: overallPercent,
        },
        {
          id: "totalParticipants",
          label: "Total Participants",
          unit: "participants",
          value: totalParticipants,
        },
        {
          id: "avgTeamSize",
          label: "Average Team Size",
          unit: "members_per_team",
          value: averageTeamSize,
        },
        {
          id: "pptSubmissionRate",
          label: "PPT Submission Rate",
          unit: "percent",
          value: submissionRatePercent,
        },
      ],
      charts: {
        approvalStatusDistribution: {
          chartType: "donut",
          labels: approvalStatusBreakdown.map((item) => item.status),
          series: [
            {
              data: approvalStatusBreakdown.map((item) => item.teams),
              name: "Teams",
            },
          ],
        },
        fillRatePerProblemStatement: {
          chartType: "bar",
          labels: labelsByStatement,
          series: [
            {
              data: registrationsPerProblemStatement.map(
                (item) => item.fillRatePercent,
              ),
              name: "Fill Rate %",
            },
          ],
        },
        registrationTrendByDate: {
          chartType: "line",
          labels: registrationTrendByDate.map((item) => item.date),
          series: [
            {
              data: registrationTrendByDate.map((item) => item.registrations),
              name: "Registrations",
            },
          ],
        },
        registrationsPerProblemStatement: {
          chartType: "bar",
          labels: labelsByStatement,
          series: [
            {
              data: registrationsPerProblemStatement.map(
                (item) => item.registeredTeams,
              ),
              name: "Registrations",
            },
            {
              data: registrationsPerProblemStatement.map((item) => item.cap),
              name: "Capacity",
            },
          ],
        },
        teamTypeDistribution: {
          chartType: "donut",
          labels: teamTypeBreakdown.map((item) => item.teamType),
          series: [
            {
              data: teamTypeBreakdown.map((item) => item.teams),
              name: "Teams",
            },
          ],
        },
      },
    },
  });
};

export type { RegistrationStatsResponse };
