import Link from "next/link";
import { FnButton } from "@/components/ui/fn-button";
import { InView } from "@/components/ui/in-view";
import {
  PROBLEM_STATEMENT_CAP,
  PROBLEM_STATEMENTS,
} from "@/data/problem-statements";

export default function ProblemStatementsPage() {
  const statements = PROBLEM_STATEMENTS;
  const bentoSpanClasses = [
    "md:col-span-2 lg:col-span-4",
    "lg:col-span-2",
    "lg:col-span-2",
    "lg:col-span-4",
    "lg:col-span-3",
    "lg:col-span-3",
    "lg:col-span-2",
    "lg:col-span-4",
    "lg:col-span-3",
    "lg:col-span-3",
  ] as const;
  const bentoToneClasses = [
    "border-fnblue/20 from-fnblue/10 via-white to-background",
    "border-fnyellow/25 from-fnyellow/20 via-white to-background",
    "border-fngreen/25 from-fngreen/12 via-white to-background",
    "border-fnorange/25 from-fnorange/14 via-white to-background",
  ] as const;
  const keyFacts = [
    {
      label: "Tracks",
      tone: "text-fnblue",
      value: `${statements.length}`,
    },
    {
      label: "Lock Policy",
      tone: "text-fnred",
      value: "One-Time",
    },
    {
      label: "Max Teams / Track",
      tone: "text-fngreen",
      value: PROBLEM_STATEMENT_CAP,
    },
  ] as const;

  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-35 pointer-events-none"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="absolute -top-28 -right-16 size-96 rounded-full bg-fnblue/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -left-16 size-112 rounded-full bg-fnyellow/25 blur-3xl pointer-events-none" />

      <div className="fncontainer relative py-16 md:py-24">
        <InView
          once
          transition={{ duration: 0.3, ease: "easeOut" }}
          variants={{
            hidden: { opacity: 0, y: 24, filter: "blur(5px)" },
            visible: { opacity: 1, y: 0, filter: "blur(0px)" },
          }}
        >
          <section className="relative overflow-hidden rounded-2xl border bg-background/95 p-8 md:p-10 text-foreground shadow-2xl border-b-4 border-fnblue backdrop-blur-sm">
            <div
              className="absolute inset-0 opacity-10 pointer-events-none bg-repeat bg-center"
              style={{ backgroundImage: "url(/textures/noise-main.svg)" }}
            />
            <div className="absolute -top-8 -right-8 size-36 rounded-full bg-fnblue/20 blur-2xl pointer-events-none motion-safe:animate-[float-soft_10s_ease-in-out_infinite]" />
            <div className="absolute -bottom-10 -left-8 size-28 rounded-full bg-fnyellow/30 blur-2xl pointer-events-none motion-safe:animate-[float-soft_12s_ease-in-out_infinite]" />

            <div className="relative">
              <p className="inline-flex rounded-full border-2 tracking-wider border-fnblue bg-fnblue/20 px-3 text-sm font-extrabold uppercase text-fnblue">
                Problem Statements
              </p>
              <h1 className="mt-4 text-4xl md:text-6xl font-extrabold uppercase tracking-tighter">
                <span className="italic">innovation</span> tracks.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-foreground/80 max-w-5xl font-medium">
                Review all tracks before registration. During onboarding, your
                team must lock exactly one statement and then create the team.
                This lock is final and cannot be changed later.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {keyFacts.map((fact) => (
                  <div
                    key={fact.label}
                    className="bg-gray-100 px-4 py-3 rounded-lg border border-b-4 border-fngreen nth-[2]:border-fnred nth-[1]:border-fnblue"
                  >
                    <p className="text-xs font-bold uppercase text-foreground/80 tracking-wider">
                      {fact.label}
                    </p>
                    <p className={`mt-1 text-xl font-black ${fact.tone}`}>
                      {fact.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* <div className="mt-6 rounded-xl border border-fnblue/25 bg-gradient-to-r from-fnblue/10 via-white to-fnyellow/10 p-4 md:p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-fnblue font-semibold">
                Lock Rules
              </p>
              <ul className="mt-2 space-y-1 text-sm text-foreground/80">
                <li>Team creation is enabled only after a successful lock.</li>
                <li>Statement assignment is saved with your team record.</li>
                <li>Each team can lock one statement per registration.</li>
                <li>This lock is a one-time action and cannot be reverted.</li>
              </ul>
            </div> */}

              <div className="mt-8 flex flex-wrap gap-3">
                <FnButton asChild tone="blue">
                  <Link href="/register">Register Now!</Link>
                </FnButton>
                <FnButton asChild tone="gray">
                  <Link href="/">Back To Home</Link>
                </FnButton>
              </div>

              <div className="mt-8 rounded-xl border border-foreground/15 bg-white/70 p-4 md:p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-fnblue font-semibold">
                  Available Problem Statements
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
                  {statements.map((statement, index) => (
                    <InView
                      key={statement.id}
                      once
                      className={
                        bentoSpanClasses[index % bentoSpanClasses.length]
                      }
                      transition={{
                        duration: 0.2 + (index % 5) * 0.03,
                        ease: "easeOut",
                        delay: 0.02,
                      }}
                      variants={{
                        hidden: { opacity: 0, y: 18, filter: "blur(3px)" },
                        visible: { opacity: 1, y: 0, filter: "blur(0px)" },
                      }}
                    >
                      <div
                        className={`group relative h-full overflow-hidden rounded-xl border border-b-4 bg-linear-to-br p-5 shadow-sm transition-all duration-[var(--motion-duration-base)] ease-[var(--motion-ease-standard)] hover:-translate-y-0.5 hover:shadow-lg ${bentoToneClasses[index % bentoToneClasses.length]}`}
                      >
                        <div className="absolute -right-8 -top-8 size-24 rounded-full bg-fnblue/15 blur-2xl pointer-events-none" />
                        <div className="absolute -bottom-10 -left-10 size-24 rounded-full bg-fnyellow/20 blur-2xl pointer-events-none" />
                        <div className="relative">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-fnblue/80">
                              Track {index + 1}
                            </p>
                            <span className="inline-flex size-7 items-center justify-center rounded-full border border-fnblue/25 bg-white/90 text-xs font-black text-fnblue transition-colors group-hover:bg-fnblue group-hover:text-white">
                              {index + 1}
                            </span>
                          </div>
                          <div className="h-px w-14 bg-linear-to-r from-fnblue/80 to-transparent" />
                        </div>
                        <h3 className="mt-3 text-base font-black uppercase tracking-wider leading-tightest">
                          {statement.title}
                        </h3>
                        <p className="mt-3 text-sm text-foreground/80 font-medium leading-relaxed">
                          {statement.summary}
                        </p>
                      </div>
                    </InView>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </InView>
      </div>
    </main>
  );
}
