import { Head, Tailwind } from "@react-email/components";
import { cn } from "@/lib/utils";

export interface EmailTemplateProps {
  abandonedAtIso?: string;
  ctaBaseUrl?: string | null;
  leadEmail: string;
  leadName: string;
  lockExpiresAtIso: string;
  lockedAtIso: string;
  notificationType: "lock_confirmed" | "lock_abandoned";
  problemStatementId: string;
  problemStatementSummary: string;
  problemStatementTitle: string;
  teamName: string;
}

const formatIstDateTime = (isoTimestamp: string) => {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return {
      istLabel: "Invalid timestamp",
      isoLabel: isoTimestamp,
    };
  }

  return {
    istLabel: new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(parsed),
    isoLabel: parsed.toISOString(),
  };
};

const getCtaHref = (baseUrl: string | null | undefined, path: string) => {
  if (!baseUrl) return null;
  return `${baseUrl}${path}`;
};

const EMAIL_TAILWIND_CONFIG = {
  theme: {
    extend: {
      colors: {
        fnblue: "#2772a0",
        fngreen: "#009e60",
        fnred: "#bc2c1a",
        fnyellow: "#f5d000",
      },
    },
  },
} as const;

export function EmailTemplate({
  abandonedAtIso,
  ctaBaseUrl,
  leadEmail,
  leadName,
  lockExpiresAtIso,
  lockedAtIso,
  notificationType,
  problemStatementId,
  problemStatementSummary,
  problemStatementTitle,
  teamName,
}: EmailTemplateProps) {
  const lockedAt = formatIstDateTime(lockedAtIso);
  const lockExpiresAt = formatIstDateTime(lockExpiresAtIso);
  const abandonedAt = formatIstDateTime(abandonedAtIso ?? "");
  const isAbandonedNotice = notificationType === "lock_abandoned";
  const statementsHref = getCtaHref(ctaBaseUrl, "/problem-statements");

  const heading = isAbandonedNotice
    ? "Registration Abandoned"
    : "Problem Statement Locked";
  const subtitle = isAbandonedNotice
    ? "Your lock has been released because the registration flow was not completed."
    : "Your selected problem statement is now reserved for this draft.";
  const statusText = isAbandonedNotice
    ? "Problem Statement Lock Released"
    : "Problem Statement Locked Successfully";
  const introCopy = isAbandonedNotice
    ? "You exited before finishing team registration. Start again and lock a problem statement to continue."
    : "Your team has successfully selected a problem statement for Foundathon 3.0. Complete registration before lock expiry to keep this selection.";

  return (
    <Tailwind config={EMAIL_TAILWIND_CONFIG}>
      <Head />
      <div className="bg-slate-100 px-3 py-8">
        <div className="mx-auto w-full max-w-2xl">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div
              className={cn(
                "h-1 w-full",
                isAbandonedNotice ? "bg-fnred" : "bg-fnblue",
              )}
            />

            <header className="px-6 pb-4 pt-6 md:px-8 md:pt-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Foundathon 3.0 | Monopoly Edition | 2026
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                {heading}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {subtitle}
              </p>
              <p
                className={cn(
                  "mt-4 inline-flex rounded-full border-2 px-3 text-xs font-bold uppercase tracking-wider",
                  isAbandonedNotice
                    ? "border-fnred bg-fnred/20 text-fnred"
                    : "border-fngreen bg-fngreen/20 text-fngreen",
                )}
              >
                {statusText}
              </p>
            </header>

            <main className="space-y-4 px-6 pb-6 md:space-y-5 md:px-8 md:pb-8">
              <section className="p-4">
                <p className="text-sm text-slate-700">
                  Hi{" "}
                  <span className="font-semibold text-slate-900">
                    {leadName}
                  </span>
                  ,
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {introCopy}
                </p>
              </section>

              <div className="grid gap-2 grid-cols-3">
                <section className="col-span-1 rounded-lg border border-b-4 border-fnblue p-4">
                  <h2 className="font-bold uppercase tracking-wide">
                    Team Details
                  </h2>
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-fnblue">
                        Team Name
                      </p>
                      <p className="mt-1 text-sm text-slate-800">{teamName}</p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-fnblue">
                        Lead Email
                      </p>
                      <p className="mt-1 text-sm text-slate-800">{leadEmail}</p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-fnblue">
                        Status
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        {statusText}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="col-span-2 rounded-lg border border-b-4 border-fngreen p-4">
                  <h2 className="font-bold uppercase tracking-wide">
                    Timeline
                  </h2>
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-fngreen">
                        Locked At (IST)
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        {lockedAt.istLabel}
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-fngreen">
                        Locked At (ISO)
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        {lockedAt.isoLabel}
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-fngreen">
                        Lock Expires (IST)
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        {lockExpiresAt.istLabel}
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-fngreen">
                        Lock Expires (ISO)
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        {lockExpiresAt.isoLabel}
                      </p>
                    </div>
                    {isAbandonedNotice ? (
                      <>
                        <div className="flex flex-col">
                          <p className="text-sm font-semibold text-fngreen">
                            Abandoned At (IST)
                          </p>
                          <p className="mt-1 text-sm text-slate-800">
                            {abandonedAt.istLabel}
                          </p>
                        </div>
                        <div className="flex flex-col">
                          <p className="text-sm font-semibold text-fngreen">
                            Abandoned At (ISO)
                          </p>
                          <p className="mt-1 text-sm text-slate-800">
                            {abandonedAt.isoLabel}
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                </section>

                <section className="col-span-3 rounded-lg border border-b-4 border-fnred p-4">
                  <h2 className="font-bold uppercase tracking-wide">
                    Problem Statement
                  </h2>
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-fnred">
                        Statement ID
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        {problemStatementId}
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-fnred">Title</p>
                      <p className="mt-1 text-sm text-slate-800">
                        {problemStatementTitle}
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-fnred">
                        Summary
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        {problemStatementSummary || "Summary unavailable"}
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              {statementsHref ? (
                <section className="mt-4">
                  <a
                    className="inline-flex rounded-lg border border-b-4 border-fnyellow bg-fnyellow/70 px-4 py-3 font-semibold tracking-tight no-underline"
                    href={statementsHref}
                  >
                    View Other Problem Statements
                  </a>
                </section>
              ) : null}
            </main>

            <footer className="border-t border-slate-200 px-6 py-4 md:px-8">
              <p className="text-xs text-slate-500">
                This is an automated message from the Foundathon lock workflow.
              </p>
            </footer>
          </article>
        </div>
      </div>
    </Tailwind>
  );
}
