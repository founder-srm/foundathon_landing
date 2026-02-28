import { timingSafeEqual } from "node:crypto";
import { notFound } from "next/navigation";
import { getFoundathonStatsPageKey } from "@/server/env";
import {
  getRegistrationStats,
  type RegistrationStatsResponse,
} from "@/server/registration-stats/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StatsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const toSingleSearchParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const isValidPageKey = ({
  expected,
  provided,
}: {
  expected: string;
  provided: string;
}) => {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
};

const toBarWidth = (value: number) => `${Math.max(0, Math.min(100, value))}%`;

const formatGeneratedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
};

const toStatusTone = (status: string) => {
  switch (status) {
    case "accepted":
      return "text-fngreen";
    case "rejected":
      return "text-fnred";
    case "submitted":
      return "text-fnblue";
    case "invalid":
      return "text-fnorange";
    default:
      return "text-foreground/80";
  }
};

type StatsErrorHelp = {
  details: string[];
  headline: string;
  quickChecks: string[];
};

const getStatsErrorHelp = (error: string): StatsErrorHelp => {
  const normalized = error.trim().toLowerCase();

  if (normalized.includes("service role client is not configured")) {
    return {
      details: [
        "Supabase service-role environment variables are missing in the runtime where Next.js is running.",
        "This page can render only when server-side stats queries can authenticate with Supabase service role credentials.",
      ],
      headline: "Missing Supabase Service-Role Configuration",
      quickChecks: [
        "Confirm runtime has NEXT_PUBLIC_SUPABASE_URL",
        "Confirm runtime has SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE",
        "If using Doppler, start app with: doppler run -- bun dev",
      ],
    };
  }

  if (normalized.includes("failed to fetch registrations for stats")) {
    return {
      details: [
        "The stats query reached Supabase but the registration read failed.",
        "This commonly means wrong project credentials, missing table, or access constraints in the connected project.",
      ],
      headline: "Supabase Query Failed",
      quickChecks: [
        "Verify eventsregistrations table exists in the connected Supabase project",
        "Verify runtime keys point to the intended Supabase URL/project",
        "Check Supabase logs for failed query details while loading /stats",
      ],
    };
  }

  return {
    details: [
      "The stats service returned an unexpected failure.",
      "Use the raw error and server logs to identify the exact failing dependency.",
    ],
    headline: "Unexpected Stats Service Error",
    quickChecks: [
      "Review server console logs for this request",
      "Confirm Doppler/runtime variables are loaded into the Next process",
      "Call /api/stats/registrations with x-foundathon-stats-key to compare behavior",
    ],
  };
};

const ChartBars = ({
  items,
  valueLabel,
}: {
  items: Array<{ label: string; percent: number; value: number }>;
  valueLabel: string;
}) => (
  <div className="space-y-3">
    {items.map((item) => (
      <div
        key={item.label}
        className="rounded-lg border border-foreground/10 bg-white p-3"
      >
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{item.label}</span>
          <span className="text-foreground/70">
            {item.value} {valueLabel} ({item.percent}%)
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-fnblue"
            style={{ width: toBarWidth(item.percent) }}
          />
        </div>
      </div>
    ))}
  </div>
);

const StatsContent = ({ stats }: { stats: RegistrationStatsResponse }) => {
  const statementRows = stats.requiredStats.registrationsPerProblemStatement;

  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="fncontainer relative py-12 md:py-16">
        <section className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 shadow-xl md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="inline-flex rounded-full border border-fnblue bg-fnblue/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-fnblue">
                Private Stats
              </p>
              <h1 className="mt-3 text-3xl font-black uppercase tracking-tight md:text-4xl">
                Registration Analytics
              </h1>
              <p className="mt-2 text-sm text-foreground/70">
                {stats.event.eventTitle} ({stats.event.eventId})
              </p>
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/60">
              Generated (UTC): {formatGeneratedAt(stats.generatedAt)}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {stats.visualData.cards.map((card) => (
              <div
                key={card.id}
                className="rounded-xl border border-b-4 border-fnblue bg-white px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-black text-fnblue">
                  {card.value}
                  {card.unit === "percent" ? "%" : ""}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-foreground/10 bg-white p-4">
              <h2 className="text-lg font-black uppercase tracking-tight">
                Required Metrics
              </h2>
              <div className="mt-3 space-y-2 text-sm font-medium">
                <p>
                  Total teams registered:{" "}
                  <span className="font-black text-fnblue">
                    {stats.requiredStats.totalTeamsRegistered}
                  </span>
                </p>
                <p>
                  Overall fill rate:{" "}
                  <span className="font-black text-fngreen">
                    {stats.requiredStats.rateOfFilling.overallPercent}%
                  </span>
                </p>
                <p>
                  Filled teams: {stats.requiredStats.rateOfFilling.filledTeams}{" "}
                  / {stats.requiredStats.rateOfFilling.capacityTeams}
                </p>
                <p>
                  Remaining teams:{" "}
                  {stats.requiredStats.rateOfFilling.remainingTeams}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-foreground/10 bg-white p-4">
              <h2 className="text-lg font-black uppercase tracking-tight">
                Data Filters
              </h2>
              <div className="mt-3 space-y-2 text-sm font-medium">
                <p>Included rows: {stats.filters.includedRows}</p>
                <p>Excluded rows: {stats.filters.excludedRows}</p>
                <p className="text-xs text-foreground/70">
                  Excluded emails:{" "}
                  {stats.filters.excludedRegistrationEmails.join(", ") ||
                    "none"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-foreground/10 bg-white p-4">
            <h2 className="text-lg font-black uppercase tracking-tight">
              Registrations Per Problem Statement
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-foreground/60">
                  <tr>
                    <th className="pb-2">Statement</th>
                    <th className="pb-2">Teams</th>
                    <th className="pb-2">Cap</th>
                    <th className="pb-2">Remaining</th>
                    <th className="pb-2">Fill</th>
                  </tr>
                </thead>
                <tbody>
                  {statementRows.map((row) => (
                    <tr
                      key={row.problemStatementId}
                      className="border-t border-foreground/10"
                    >
                      <td className="py-3 pr-3">
                        <p className="font-semibold">{row.title}</p>
                        <p className="text-xs text-foreground/60">
                          {row.problemStatementId}
                        </p>
                      </td>
                      <td className="py-3 font-semibold">
                        {row.registeredTeams}
                      </td>
                      <td className="py-3">{row.cap}</td>
                      <td className="py-3">{row.remainingTeams}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-14 font-semibold">
                            {row.fillRatePercent}%
                          </span>
                          <div className="h-2 w-36 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-fnblue"
                              style={{ width: toBarWidth(row.fillRatePercent) }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-foreground/10 bg-white p-4">
              <h2 className="text-lg font-black uppercase tracking-tight">
                Team Type Split
              </h2>
              <div className="mt-4">
                <ChartBars
                  items={stats.additionalStats.teamTypeBreakdown.map(
                    (item) => ({
                      label: item.teamType,
                      percent: item.percent,
                      value: item.teams,
                    }),
                  )}
                  valueLabel="teams"
                />
              </div>
            </div>

            <div className="rounded-xl border border-foreground/10 bg-white p-4">
              <h2 className="text-lg font-black uppercase tracking-tight">
                Approval Status Split
              </h2>
              <div className="mt-4">
                <ChartBars
                  items={stats.additionalStats.approvalStatusBreakdown.map(
                    (item) => ({
                      label: item.status,
                      percent: item.percent,
                      value: item.teams,
                    }),
                  )}
                  valueLabel="teams"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-3">
            <div className="rounded-xl border border-foreground/10 bg-white p-4">
              <h2 className="text-lg font-black uppercase tracking-tight">
                Participation
              </h2>
              <div className="mt-3 space-y-2 text-sm font-medium">
                <p>
                  Total participants:{" "}
                  {stats.additionalStats.participation.totalParticipants}
                </p>
                <p>
                  Average team size:{" "}
                  {stats.additionalStats.participation.averageTeamSize}
                </p>
                <p>
                  Submitted PPT teams:{" "}
                  {stats.additionalStats.presentationSubmission.submittedTeams}
                </p>
                <p>
                  Pending PPT teams:{" "}
                  {stats.additionalStats.presentationSubmission.pendingTeams}
                </p>
                <p>
                  PPT submission rate:{" "}
                  {
                    stats.additionalStats.presentationSubmission
                      .submissionRatePercent
                  }
                  %
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-foreground/10 bg-white p-4">
              <h2 className="text-lg font-black uppercase tracking-tight">
                Anomalies
              </h2>
              <ul className="mt-3 space-y-2 text-sm font-medium">
                <li>
                  Missing statement id:{" "}
                  {stats.additionalStats.anomalies.missingProblemStatementId}
                </li>
                <li>
                  Unknown statement id:{" "}
                  {stats.additionalStats.anomalies.unknownProblemStatementId}
                </li>
                <li>
                  Invalid team type:{" "}
                  {stats.additionalStats.anomalies.missingOrInvalidTeamType}
                </li>
                <li>
                  Invalid team members:{" "}
                  {stats.additionalStats.anomalies.missingOrInvalidTeamMembers}
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-foreground/10 bg-white p-4">
              <h2 className="text-lg font-black uppercase tracking-tight">
                Time Bounds
              </h2>
              <div className="mt-3 space-y-2 text-sm font-medium">
                <p>
                  First registration:{" "}
                  {stats.additionalStats.firstRegistrationAt ?? "not available"}
                </p>
                <p>
                  Last registration:{" "}
                  {stats.additionalStats.lastRegistrationAt ?? "not available"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-foreground/10 bg-white p-4">
            <h2 className="text-lg font-black uppercase tracking-tight">
              Registration Trend (UTC Date)
            </h2>
            {stats.additionalStats.registrationTrendByDate.length === 0 ? (
              <p className="mt-3 text-sm text-foreground/70">
                No trend data available yet.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {stats.additionalStats.registrationTrendByDate.map((item) => (
                  <div
                    key={item.date}
                    className="rounded-lg border border-foreground/10 bg-gray-50 px-3 py-2 text-sm font-medium"
                  >
                    {item.date}: {item.registrations}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 rounded-xl border border-foreground/10 bg-white p-4">
            <h2 className="text-lg font-black uppercase tracking-tight">
              Approval Status Legend
            </h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
              {stats.additionalStats.approvalStatusBreakdown.map((item) => (
                <span key={item.status} className={toStatusTone(item.status)}>
                  {item.status}: {item.teams}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const params = await searchParams;
  const providedKey = toSingleSearchParam(params.key)?.trim();
  const expectedKey = getFoundathonStatsPageKey()?.trim();

  if (!providedKey || !expectedKey) {
    notFound();
  }

  if (!isValidPageKey({ expected: expectedKey, provided: providedKey })) {
    notFound();
  }

  const result = await getRegistrationStats();
  if (!result.ok) {
    const help = getStatsErrorHelp(result.error);

    return (
      <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
        <div className="fncontainer relative py-16">
          <section className="mx-auto max-w-3xl rounded-2xl border border-b-4 border-fnred bg-background p-8 shadow-xl">
            <h1 className="text-2xl font-black uppercase tracking-tight text-fnred">
              Stats Unavailable
            </h1>
            <p className="mt-2 text-sm font-bold uppercase tracking-wider text-fnred/90">
              {help.headline}
            </p>
            <p className="mt-3 text-sm font-medium text-foreground/80">
              {result.error}
            </p>

            <div className="mt-5 rounded-xl border border-foreground/10 bg-white p-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-fnblue">
                What this means
              </p>
              <ul className="mt-2 space-y-2 text-sm font-medium text-foreground/80">
                {help.details.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-foreground/10 bg-white p-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-fnblue">
                Quick checks
              </p>
              <ul className="mt-2 space-y-2 text-sm font-medium text-foreground/80">
                {help.quickChecks.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return <StatsContent stats={result.data} />;
}
