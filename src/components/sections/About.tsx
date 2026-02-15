"use client";

import { useEffect, useMemo, useState } from "react";
import { PROBLEM_STATEMENT_RELEASE_DATE } from "@/data/problem-statement-release";
import { getProblemReleaseCountdown } from "@/lib/problem-release-countdown";

const problemHighlights = [
  {
    title: "Partner Territories (Problem Claims)",
    detail:
      "High-impact problem statements are curated by partner companies. Think of each one as a premium property tile that teams can claim early.",
  },
  {
    title: "First-Come, First-Serve Draft",
    detail:
      "Selection is strictly first-come, first-serve for each statement. Once a problem tile is full, teams must choose another open tile.",
  },
  {
    title: "PPT Submission Cap Rule",
    detail:
      "When a certain number of teams for a statement submits PPTs, that statement is disabled and no additional team can opt for it.",
  },
];

const About = () => {
  const releaseDate = useMemo(() => PROBLEM_STATEMENT_RELEASE_DATE, []);
  const [timeLeft, setTimeLeft] = useState(() => getProblemReleaseCountdown());

  useEffect(() => {
    const tick = () => setTimeLeft(getProblemReleaseCountdown());
    const intervalId = window.setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <section className="bg-background text-foreground font-mono relative">
      <div className="fncontainer relative py-20 md:py-24 space-y-16">
        <div className="space-y-5 text-center max-w-4xl mx-auto">
          <p className="rounded-full inline-flex px-3 uppercase font-bold tracking-wide bg-fngreen/20 text-fngreen border-2 border-fngreen">
            Fastest Fingers First
          </p>
          <h2 className="text-5xl md:text-6xl font-bold tracking-tighter uppercase text-balance">
            claim your block,
            <span className="text-fnblue italic font-extrabold">
              {" "}
              build your edge.
            </span>
          </h2>
          <p className="text-foreground/70 max-w-3xl mx-auto text-lg">
            Navigate curated company problems, lock your team slot early, and
            push from guided build to championship pitch in a high-intensity
            boardroom sprint.
          </p>
        </div>

        <div id="rules" className="grid gap-6 md:grid-cols-3 scroll-mt-28">
          {problemHighlights.map((item) => (
            <div
              key={item.title}
              className="rounded-xl bg-gray-100 border-b-4 border-fnblue border px-6 py-7 shadow-sm"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-fnblue font-bold">
                Board Rule
              </p>
              <h3 className="text-2xl font-bold tracking-tight mt-3">
                {item.title}
              </h3>
              <p className="mt-4 text-sm text-foreground/80 leading-relaxed">
                {item.detail}
              </p>
            </div>
          ))}
        </div>

        <div
          id="release"
          className="rounded-2xl border border-b-4 border-fngreen bg-background/90 p-8 space-y-6 shadow-sm scroll-mt-28"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-fngreen font-bold">
                Problem Statement Release
              </p>
              <h3 className="text-3xl md:text-4xl font-bold tracking-tight uppercase">
                countdown clock
              </h3>
            </div>
            <div className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">
              claim opens when timer hits zero
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Days", value: timeLeft.days },
              { label: "Hours", value: timeLeft.hours },
              { label: "Minutes", value: timeLeft.minutes },
              { label: "Seconds", value: timeLeft.seconds },
            ].map((unit) => (
              <div
                key={unit.label}
                className="rounded-xl border bg-linear-to-b from-white to-gray-100 p-5 border-b-4 border-fnblue text-center shadow-sm"
              >
                <p className="text-4xl md:text-5xl font-black tracking-tight text-fnblue">
                  {unit.value}
                </p>
                <p className="text-xs uppercase tracking-[0.25em] text-foreground/70 mt-2">
                  {unit.label}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-foreground/10 bg-gray-100 px-5 py-4 space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-foreground/70">
              Release Time
            </p>
            <p className="text-lg md:text-xl font-bold">
              {releaseDate.toLocaleString("en-IN", { timeZoneName: "short" })}
            </p>
            <p className="text-sm text-foreground/70">
              UTC: {releaseDate.toUTCString()}
            </p>
            <p className="text-sm text-foreground/70" aria-live="polite">
              {timeLeft.invalid
                ? "Release date configuration is invalid. Please update the constant value."
                : timeLeft.released
                  ? "Problem statements are now live."
                  : "The first-come, first-serve draft begins as soon as this countdown ends."}
            </p>
          </div>
        </div>

        <div
          id="champion"
          className="rounded-2xl border bg-linear-to-br from-fnred to-fnredb border-b-4 border-fnredb text-white p-8 md:p-10 scroll-mt-28 shadow-lg relative overflow-hidden"
        >
          <div
            className="absolute inset-0 opacity-100 mix-blend-multiply pointer-events-none bg-repeat bg-center"
            style={{ backgroundImage: "url(/textures/noise-main.svg)" }}
          ></div>
          <div className="absolute -top-10 -right-12 size-36 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 size-28 rounded-full bg-fnyellow/20 blur-2xl" />

          <div className="relative space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full border border-white/35 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em]">
                Winner Goodies
              </span>
              <span className="inline-flex rounded-full border border-fnyellow/40 bg-fnyellow/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-fnyellow">
                Monopoly Payout Zone
              </span>
            </div>

            <h3 className="text-3xl md:text-4xl font-black tracking-tight uppercase leading-tight">
              every problem statement winner unlocks premium rewards
            </h3>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/25 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/70 font-semibold">
                  Certification Reward
                </p>
                <p className="text-lg font-bold mt-2 leading-snug">
                  Nationally and internationally recognized certificates
                </p>
              </div>
              <div className="rounded-lg border border-white/25 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/70 font-semibold">
                  Career Reward
                </p>
                <p className="text-lg font-bold mt-2 leading-snug">
                  Internship opportunities from relevant partner tracks
                </p>
              </div>
            </div>

            <p className="text-white/90 text-base md:text-lg leading-relaxed">
              Rewards are tied to the problem track you choose and the partner
              company’s evaluation outcomes.
            </p>

            <div className="rounded-md border border-white/20 bg-black/10 px-4 py-3">
              <p className="text-xs md:text-sm uppercase tracking-[0.16em] text-white/80">
                * Internship access is subject to the selected problem
                statement, company policy, and final shortlist decisions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
