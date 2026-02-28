import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PROBLEM_STATEMENT_CAP,
  PROBLEM_STATEMENTS,
} from "@/data/problem-statements";

const mocks = vi.hoisted(() => ({
  getFoundathonStatsExcludedEmails: vi.fn(),
  getServiceRoleSupabaseClient: vi.fn(),
}));

vi.mock("@/server/env", () => ({
  getFoundathonStatsExcludedEmails: mocks.getFoundathonStatsExcludedEmails,
}));

vi.mock("@/server/supabase/service-role-client", () => ({
  getServiceRoleSupabaseClient: mocks.getServiceRoleSupabaseClient,
}));

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

const createSupabaseClientMock = (result: QueryResult) => {
  const eqByEventId = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq: eqByEventId });
  const from = vi.fn().mockReturnValue({ select });

  return { from };
};

describe("registration stats service", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getFoundathonStatsExcludedEmails.mockReset();
    mocks.getServiceRoleSupabaseClient.mockReset();

    mocks.getFoundathonStatsExcludedEmails.mockReturnValue([
      "opdhaker2007@gmail.com",
    ]);
  });

  it("returns 500 when service role client is unavailable", async () => {
    mocks.getServiceRoleSupabaseClient.mockReturnValue(null);
    const { getRegistrationStats } = await import("./service");

    const result = await getRegistrationStats();

    expect(result).toEqual({
      error: "Stats service role client is not configured.",
      ok: false,
      status: 500,
    });
  });

  it("returns 500 when fetching rows fails", async () => {
    const supabase = createSupabaseClientMock({
      data: null,
      error: { message: "boom", code: "42703" },
    });
    mocks.getServiceRoleSupabaseClient.mockReturnValue(supabase);
    const { getRegistrationStats } = await import("./service");

    const result = await getRegistrationStats();

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.status).toBe(500);
    expect(result.error).toContain("Failed to fetch registrations for stats.");
    expect(result.error).toContain("code=42703");
    expect(result.error).toContain("message=boom");
  });

  it("returns zeroed stats with stable shapes when there are no rows", async () => {
    const supabase = createSupabaseClientMock({
      data: [],
      error: null,
    });
    mocks.getServiceRoleSupabaseClient.mockReturnValue(supabase);
    const { getRegistrationStats } = await import("./service");

    const result = await getRegistrationStats();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.requiredStats.totalTeamsRegistered).toBe(0);
    expect(result.data.requiredStats.rateOfFilling).toEqual({
      capacityTeams: PROBLEM_STATEMENTS.length * PROBLEM_STATEMENT_CAP,
      filledTeams: 0,
      overallPercent: 0,
      remainingTeams: PROBLEM_STATEMENTS.length * PROBLEM_STATEMENT_CAP,
    });
    expect(
      result.data.requiredStats.registrationsPerProblemStatement,
    ).toHaveLength(PROBLEM_STATEMENTS.length);
    expect(result.data.additionalStats.registrationTrendByDate).toEqual([]);
    expect(result.data.additionalStats.firstRegistrationAt).toBeNull();
    expect(result.data.additionalStats.lastRegistrationAt).toBeNull();

    const statementChart =
      result.data.visualData.charts.registrationsPerProblemStatement;
    expect(statementChart.labels).toHaveLength(PROBLEM_STATEMENTS.length);
    expect(statementChart.series[0]?.data).toHaveLength(
      statementChart.labels.length,
    );
    expect(statementChart.series[1]?.data).toHaveLength(
      statementChart.labels.length,
    );
  });

  it("computes required and additional stats with exclusion, anomalies, and chart consistency", async () => {
    const ps01 = PROBLEM_STATEMENTS[0];
    const ps02 = PROBLEM_STATEMENTS[1];
    if (!ps01 || !ps02) {
      throw new Error("Expected at least two problem statements in test data.");
    }

    const rows = [
      {
        created_at: "2026-02-01T08:00:00.000Z",
        details: {
          lead: { name: "Lead 1" },
          members: [{ name: "M1" }, { name: "M2" }],
          presentationPublicUrl: "https://example.com/ppt-1",
          problemStatementId: ps01.id,
          teamType: "srm",
        },
        id: "1",
        is_approved: "Accepted",
        registration_email: "alpha@example.com",
      },
      {
        created_at: "2026-02-01T12:00:00.000Z",
        details: {
          lead: { name: "Lead 2" },
          members: [{ name: "M1" }, { name: "M2" }, { name: "M3" }],
          problemStatementId: ps01.id,
          teamType: "non_srm",
        },
        id: "2",
        is_approved: "submitted",
        registration_email: "beta@example.com",
      },
      {
        created_at: "2026-02-02T09:00:00.000Z",
        details: {
          lead: { name: "Lead 3" },
          members: "not-an-array",
          problemStatementId: "ps-999",
          teamType: "other",
        },
        id: "3",
        is_approved: null,
        registration_email: "gamma@example.com",
      },
      {
        created_at: "2026-02-03T10:00:00.000Z",
        details: {
          presentationFileSizeBytes: 200,
        },
        id: "4",
        is_approved: "Rejected",
        registration_email: "delta@example.com",
      },
      {
        created_at: "2026-02-04T10:00:00.000Z",
        details: {
          lead: { name: "Lead 4" },
          members: [{ name: "M1" }, { name: "M2" }],
          problemStatementId: ps02.id,
          teamType: "srm",
        },
        id: "5",
        is_approved: "accepted",
        registration_email: " OPDHAKER2007@GMAIL.COM ",
      },
    ];

    const supabase = createSupabaseClientMock({
      data: rows,
      error: null,
    });
    mocks.getServiceRoleSupabaseClient.mockReturnValue(supabase);
    const { getRegistrationStats } = await import("./service");

    const result = await getRegistrationStats();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const totalCapacity = PROBLEM_STATEMENTS.length * PROBLEM_STATEMENT_CAP;
    const expectedOverallPercent =
      Math.round((2 / totalCapacity) * 10_000) / 100;

    expect(result.data.filters).toEqual({
      excludedRegistrationEmails: ["opdhaker2007@gmail.com"],
      excludedRows: 1,
      includedRows: 4,
    });
    expect(result.data.requiredStats.totalTeamsRegistered).toBe(4);
    expect(result.data.requiredStats.rateOfFilling).toEqual({
      capacityTeams: totalCapacity,
      filledTeams: 2,
      overallPercent: expectedOverallPercent,
      remainingTeams: totalCapacity - 2,
    });

    const statementOneStats =
      result.data.requiredStats.registrationsPerProblemStatement[0];
    const statementTwoStats =
      result.data.requiredStats.registrationsPerProblemStatement[1];
    expect(statementOneStats).toMatchObject({
      cap: PROBLEM_STATEMENT_CAP,
      fillRatePercent: Math.round((2 / PROBLEM_STATEMENT_CAP) * 10_000) / 100,
      isFull: false,
      problemStatementId: ps01.id,
      registeredTeams: 2,
      remainingTeams: PROBLEM_STATEMENT_CAP - 2,
      title: ps01.title,
    });
    expect(statementTwoStats).toMatchObject({
      problemStatementId: ps02.id,
      registeredTeams: 0,
    });

    expect(result.data.additionalStats.anomalies).toEqual({
      missingOrInvalidTeamMembers: 2,
      missingOrInvalidTeamType: 2,
      missingProblemStatementId: 1,
      unknownProblemStatementId: 1,
    });
    expect(result.data.additionalStats.teamTypeBreakdown).toEqual([
      { percent: 25, teamType: "srm", teams: 1 },
      { percent: 25, teamType: "non_srm", teams: 1 },
      { percent: 50, teamType: "unknown", teams: 2 },
    ]);
    expect(result.data.additionalStats.approvalStatusBreakdown).toEqual([
      { percent: 25, status: "accepted", teams: 1 },
      { percent: 25, status: "rejected", teams: 1 },
      { percent: 25, status: "submitted", teams: 1 },
      { percent: 0, status: "invalid", teams: 0 },
      { percent: 25, status: "not_reviewed", teams: 1 },
    ]);
    expect(result.data.additionalStats.presentationSubmission).toEqual({
      pendingTeams: 2,
      submissionRatePercent: 50,
      submittedTeams: 2,
    });
    expect(result.data.additionalStats.participation).toEqual({
      averageTeamSize: 1.75,
      totalParticipants: 7,
    });
    expect(result.data.additionalStats.registrationTrendByDate).toEqual([
      { date: "2026-02-01", registrations: 2 },
      { date: "2026-02-02", registrations: 1 },
      { date: "2026-02-03", registrations: 1 },
    ]);
    expect(result.data.additionalStats.firstRegistrationAt).toBe(
      "2026-02-01T08:00:00.000Z",
    );
    expect(result.data.additionalStats.lastRegistrationAt).toBe(
      "2026-02-03T10:00:00.000Z",
    );

    const statementChart =
      result.data.visualData.charts.registrationsPerProblemStatement;
    const fillRateChart =
      result.data.visualData.charts.fillRatePerProblemStatement;
    const trendChart = result.data.visualData.charts.registrationTrendByDate;
    const teamTypeChart = result.data.visualData.charts.teamTypeDistribution;
    const approvalChart =
      result.data.visualData.charts.approvalStatusDistribution;

    expect(statementChart.series[0]?.data.length).toBe(
      statementChart.labels.length,
    );
    expect(statementChart.series[1]?.data.length).toBe(
      statementChart.labels.length,
    );
    expect(fillRateChart.series[0]?.data.length).toBe(
      fillRateChart.labels.length,
    );
    expect(trendChart.series[0]?.data.length).toBe(trendChart.labels.length);
    expect(teamTypeChart.series[0]?.data.length).toBe(
      teamTypeChart.labels.length,
    );
    expect(approvalChart.series[0]?.data.length).toBe(
      approvalChart.labels.length,
    );
  });
});
