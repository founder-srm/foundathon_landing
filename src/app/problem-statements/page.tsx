"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FnButton } from "@/components/ui/fn-button";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { PROBLEM_STATEMENT_RELEASE_DATE } from "@/data/problem-statement-release";
import { getProblemReleaseCountdown } from "@/lib/problem-release-countdown";

export default function ProblemStatementsPage() {
  const [time, setTime] = useState(() => getProblemReleaseCountdown());
  const releaseDate = useMemo(() => PROBLEM_STATEMENT_RELEASE_DATE, []);

  useEffect(() => {
    const id = window.setInterval(
      () => setTime(getProblemReleaseCountdown()),
      1000,
    );
    return () => clearInterval(id);
  }, []);

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
              release countdown
            </h1>
            <p className="mt-3 text-foreground/75 max-w-2xl">
              The board opens when the timer hits zero. Claims are first-come,
              first-serve until each statement cap is reached.
            </p>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Days", value: time.days },
                { label: "Hours", value: time.hours },
                { label: "Minutes", value: time.minutes },
                { label: "Seconds", value: time.seconds },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border bg-linear-to-b from-white to-gray-100 p-5 text-center shadow-lg border-b-4 border-fnblue"
                >
                  <div className="text-6xl md:text-8xl font-black leading-none text-fnblue drop-shadow-[0_0_10px_rgba(59,130,246,0.18)] flex justify-center">
                    <SlidingNumber value={parseInt(item.value, 10)} padStart={true} />
                  </div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-fnblue/20 bg-fnblue/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-fnblue font-semibold">
                Release Time
              </p>
              <p className="mt-1 text-lg md:text-xl font-bold" suppressHydrationWarning>
                {releaseDate.toLocaleString("en-IN", { timeZoneName: "short" })}
              </p>
              <p className="text-sm text-foreground/70" suppressHydrationWarning>
                UTC: {releaseDate.toUTCString()}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <FnButton asChild tone="blue">
                <Link href="/register">Go To Registration</Link>
              </FnButton>
              <FnButton asChild tone="gray">
                <Link href="/">Back To Home</Link>
              </FnButton>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
