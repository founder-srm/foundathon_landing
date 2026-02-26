"use client";

import {
  MOTION_TRANSITIONS,
  MOTION_VARIANTS,
} from "@/lib/motion-system";
import { InView } from "../ui/in-view";

const problemHighlights = [
  {
    title: "Problem Tracks",
    detail:
      "High-impact problem statements are curated by partner companies. Each statement represents a focused track with real execution constraints.",
  },
  {
    title: "Lock Before Team Creation",
    detail:
      "Teams first complete onboarding, then lock one statement. Team registration is finalized only after the lock and create action.",
  },
  {
    title: "Per-Statement Team Cap",
    detail:
      "Each problem statement has a fixed team cap. Once filled, that statement is marked unavailable for new teams.",
  },
];

const onboardingSequence = [
  {
    step: "1. Build Team Draft",
    detail: "Fill in team details and validate members before proceeding.",
  },
  {
    step: "2. Lock One Statement",
    detail: "Choose a problem statement with available slots and lock it.",
  },
  {
    step: "3. Create Team",
    detail: "Finalize team creation and continue directly to the dashboard.",
  },
];

const ABOUT_SCROLL_VARIANTS = MOTION_VARIANTS.fadeBlurIn;
const ABOUT_CARD_VARIANTS = MOTION_VARIANTS.fadeUpSoft;

const About = () => {
  return (
    <section
      className="bg-background text-foreground font-mono relative scroll-auto"
      id="overview"
    >
      <div className="fncontainer relative py-20 md:py-24 space-y-16">
        <InView
          once
          transition={MOTION_TRANSITIONS.slow}
          variants={ABOUT_SCROLL_VARIANTS}
        >
          <div className="space-y-5 text-center max-w-4xl mx-auto">
            <p className="text-xs sm:text-sm rounded-full inline-flex px-3 uppercase font-bold tracking-wide bg-fngreen/20 text-fngreen border-2 border-fngreen">
              Structured Onboarding
            </p>
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-tighter uppercase text-balance leading-10 md:leading-14">
              claim your block,
              <span className="text-fnblue italic"> build your edge.</span>
            </h2>
            <p className="text-foreground/70 max-w-3xl mx-auto text-lg">
              Navigate curated company problems, lock your team slot early, and
              push from guided build to championship pitch in a high-intensity
              boardroom sprint.
            </p>
          </div>
        </InView>

        <div id="rules" className="grid gap-6 md:grid-cols-3 scroll-mt-28">
          {problemHighlights.map((item, key) => (
            <InView
              key={item.title}
              variants={ABOUT_CARD_VARIANTS}
              viewOptions={{ margin: "0px 0px -200px 0px" }}
              transition={{
                ...MOTION_TRANSITIONS.base,
                delay: Math.min(0.03 * key, 0.14),
              }}
              once
            >
              <div className="rounded-xl h-full bg-gray-100 border-b-4 border-fnblue border px-6 py-7 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-sm uppercase tracking-[0.2em] text-fnblue font-extrabold">
                  Board Rule
                </p>
                <h3 className="text-2xl font-bold tracking-tight mt-3">
                  {item.title}
                </h3>
                <p className="mt-4 text-base text-foreground/80 font-medium">
                  {item.detail}
                </p>
              </div>
            </InView>
          ))}
        </div>

        <InView
          once
          transition={{ ...MOTION_TRANSITIONS.slow, delay: 0.06 }}
          variants={ABOUT_SCROLL_VARIANTS}
        >
          <div className="rounded-2xl border border-b-4 border-fngreen bg-background/90 p-8 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-fngreen font-extrabold">
              Onboarding Flow
            </p>
            <h3 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tighter uppercase">
              lock. create.{" "}
              <span className="italic text-fngreen">dashboard</span>.
            </h3>
            <p className="mt-3 text-sm md:text-base text-foreground/75 font-semibold">
              {/* TODO: do this lol */}
              {/* write some text here lol */}
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {onboardingSequence.map((item, index) => (
                <InView
                  key={item.step}
                  once
                  transition={{
                    ...MOTION_TRANSITIONS.base,
                    delay: Math.min(0.04 + index * 0.03, 0.14),
                  }}
                  variants={ABOUT_CARD_VARIANTS}
                >
                  <div className="rounded-xl border border-b-4 border-fnblue bg-gray-100 px-5 py-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                    <p className="text-sm uppercase text-fnblue font-extrabold">
                      {item.step}
                    </p>
                    <p className="mt-3 text-base text-foreground/80 font-medium">
                      {item.detail}
                    </p>
                  </div>
                </InView>
              ))}
            </div>
          </div>
        </InView>

        <InView
          once
          transition={{ ...MOTION_TRANSITIONS.slow, delay: 0.1 }}
          variants={ABOUT_SCROLL_VARIANTS}
        >
          <div className="relative">
            <div
              id="champion"
              className="rounded-2xl border bg-linear-to-br from-fnred to-fnredb border-b-4 border-fnredb text-white p-8 md:p-10 scroll-mt-28 shadow-lg relative overflow-hidden"
            >
              <div
                className="absolute inset-0 opacity-100 mix-blend-multiply pointer-events-none bg-repeat bg-center"
                style={{ backgroundImage: "url(/textures/noise-main.svg)" }}
              ></div>
              <div className="absolute -top-10 -right-12 size-36 rounded-full bg-white/10 blur-2xl motion-safe:animate-[float-soft_10s_ease-in-out_infinite]" />
              <div className="absolute -bottom-8 -left-8 size-28 rounded-full bg-fnyellow/20 blur-2xl motion-safe:animate-[float-soft_12s_ease-in-out_infinite]" />

              <div className="relative space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex rounded-full border-2 border-white/40 bg-white/20 px-3 text-sm font-extrabold uppercase tracking-wider text-white/80">
                    Winner Goodies
                  </span>
                  <span className="inline-flex rounded-full border-2 border-fnyellow/40 bg-fnyellow/20 px-3 text-sm font-extrabold uppercase tracking-wider text-fnyellow/80">
                    Monopoly Payout Zone
                  </span>
                </div>

                <h3 className="text-3xl md:text-4xl font-black tracking-tight uppercase leading-tighter">
                  every problem statement winner unlocks premium rewards
                </h3>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border-2 border-white/40 bg-white/20 p-4">
                    <p className="text-sm uppercase tracking-wider text-white/80 font-bold">
                      Certification Reward
                    </p>
                    <p className="text-lg font-semibold mt-2 leading-snug">
                      Nationally and internationally recognized certificates
                    </p>
                  </div>
                  <div className="rounded-lg border-2 border-white/40 bg-white/20 p-4">
                    <p className="text-sm uppercase tracking-wider text-white/80 font-bold">
                      Career Reward
                    </p>
                    <p className="text-lg font-semibold mt-2 leading-snug">
                      Internship opportunities from relevant partner tracks
                    </p>
                  </div>
                </div>

                <p className="text-white/80 text-base md:text-lg leading-relaxed font-medium">
                  Rewards are tied to the problem track you choose and the
                  partner company’s evaluation outcomes.
                </p>
              </div>
            </div>

            <div className="absolute top-4 right-4 z-20 inline-flex w-fit group">
              <button
                type="button"
                aria-label="Internship eligibility disclaimer"
                className="inline-flex size-7 items-center justify-center rounded-full border border-white/30 bg-black/20 text-sm font-black text-white/90 transition-colors group-hover:bg-black/35 group-focus-within:bg-black/35"
              >
                i
              </button>
              <div className="pointer-events-none absolute -left-75 top-0 z-10 ml-2 w-72 -translate-y-1/2 translate-x-1 rounded-md border-[0.2px] border-white/40 bg-black/40 backdrop-blur-md px-4 py-3 opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100">
                <p className="text-xs md:text-sm text-white/80 font-medium">
                  Internship access is subject to the selected problem
                  statement, company policy, and final shortlist decisions.
                </p>
              </div>
            </div>
          </div>
        </InView>
      </div>
    </section>
  );
};

export default About;
