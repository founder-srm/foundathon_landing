import Link from "next/link";
import { FnButton } from "@/components/ui/fn-button";
import { PROBLEM_STATEMENTS } from "@/data/problem-statements";

export default function ProblemStatementsPage() {
  const statements = PROBLEM_STATEMENTS;

  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-35 pointer-events-none"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="absolute -top-28 -right-16 size-96 rounded-full bg-fnblue/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -left-16 size-112 rounded-full bg-fnyellow/25 blur-3xl pointer-events-none" />

      <div className="fncontainer relative py-16 md:py-24">
        <section className="relative overflow-hidden rounded-2xl border bg-background/95 p-8 md:p-10 text-foreground shadow-2xl border-b-4 border-fnblue backdrop-blur-sm">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none bg-repeat bg-center"
            style={{ backgroundImage: "url(/textures/noise-main.svg)" }}
          />
          <div className="absolute -top-8 -right-8 size-36 rounded-full bg-fnblue/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-8 size-28 rounded-full bg-fnyellow/30 blur-2xl pointer-events-none" />

          <div className="relative">
            <p className="inline-flex rounded-full border border-fnblue/35 bg-fnblue/10 px-3 text-xs font-bold uppercase tracking-[0.2em] text-fnblue">
              Problem Statements
            </p>
            <h1 className="mt-4 text-5xl md:text-7xl font-black uppercase tracking-tight leading-none text-balance">
              statement board
            </h1>
            <p className="mt-3 text-foreground/75 max-w-3xl">
              Review all tracks before registration. During onboarding, your
              team must lock exactly one statement and then create the team.
              This lock is final and cannot be changed later.
            </p>

            <div className="mt-6 rounded-xl border border-fnblue/25 bg-fnblue/10 p-4 md:p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-fnblue font-semibold">
                Lock Rules
              </p>
              <ul className="mt-2 space-y-1 text-sm text-foreground/80">
                <li>Team creation is enabled only after a successful lock.</li>
                <li>Statement assignment is saved with your team record.</li>
                <li>Each team can lock one statement per registration.</li>
                <li>This lock is a one-time action and cannot be reverted.</li>
              </ul>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <FnButton asChild tone="blue">
                <Link href="/register">Go To Registration</Link>
              </FnButton>
              <FnButton asChild tone="gray">
                <Link href="/">Back To Home</Link>
              </FnButton>
            </div>

            <div className="mt-8 rounded-xl border border-foreground/15 bg-white/70 p-4 md:p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-fnblue font-semibold">
                Available Problem Statements
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {statements.map((statement) => (
                  <div
                    key={statement.id}
                    className="rounded-lg border border-foreground/12 bg-background/90 p-3"
                  >
                    <p className="text-[10px] uppercase tracking-[0.16em] text-fnblue font-semibold">
                      {statement.id}
                    </p>
                    <h3 className="mt-1 text-sm font-bold uppercase tracking-[0.06em]">
                      {statement.title}
                    </h3>
                    <p className="mt-1 text-xs text-foreground/75 leading-relaxed">
                      {statement.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
