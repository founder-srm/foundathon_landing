import Link from "next/link";
import { FnButton } from "@/components/ui/fn-button";
import { getAuthUiState } from "@/lib/auth-ui-state";
import { springOptions } from "@/lib/constants";
import { MOTION_TRANSITIONS, MOTION_VARIANTS } from "@/lib/motion-system";
import { InView } from "../ui/in-view";
import { Magnetic } from "../ui/magnetic";
import HeroRegisterButton from "./HeroRegisterButton";

const content = {
  caption: "Foundathon 3.0 | Monopoly Edition | 2026",
  heading: "claim the problem",
  headingHighlight: "own the board",
  description:
    "Register your team, lock one partner-backed problem statement, and build for 2 days with direct company mentorship before the final expert-panel showdown on Day 3.",
  primaryButtonText: "Register Team",
  secondaryButtonText: "Problem Statements",
};

const HERO_REVEAL_VARIANTS = MOTION_VARIANTS.fadeLiftIn;
const HERO_TRANSITION_BASE = MOTION_TRANSITIONS.base;
const HERO_TRANSITION_SLOW = MOTION_TRANSITIONS.slow;

const Hero = async () => {
  const { isSignedIn, teamId } = await getAuthUiState();
  return (
    <section
      id="hero"
      className="bg-gray-200 text-foreground font-mono relative overflow-hidden border-b border-foreground/10 scroll-mt-10"
    >
      <div
        className="absolute inset-0 z-0 opacity-60"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="absolute inset-0 z-0 bg-linear-to-br from-white/20 via-transparent to-fnblue/12 opacity-55 motion-safe:animate-[ambient-pan_15s_ease-in-out_infinite]" />
      <div className="bg-fnyellow blur-2xl size-90 rounded-full absolute top-16 -left-16 opacity-20 z-10 motion-safe:animate-[hero-drift-yellow_14s_ease-in-out_infinite]" />
      <div className="bg-fnblue blur-[100px] size-120 rounded-full absolute -bottom-24 right-0 opacity-20 z-10 motion-safe:animate-[hero-drift-blue_18s_ease-in-out_infinite]" />
      <div className="absolute -right-20 top-20 h-56 w-56 rounded-full border border-fnblue/20 bg-fnblue/8 blur-2xl pointer-events-none motion-safe:animate-[ambient-orbit_16s_ease-in-out_infinite]" />
      <div className="fncontainer relative flex items-center justify-center min-h-[92vh] z-10 py-20">
        <div className="flex flex-col items-center gap-7 max-w-5xl">
          <InView
            once
            transition={{ ...HERO_TRANSITION_BASE, delay: 0.04 }}
            variants={MOTION_VARIANTS.fadeBlurIn}
          >
            <div className="relative w-full max-w-3xl">
              <div className="relative mx-auto flex w-fit max-w-full items-center gap-2 overflow-hidden rounded-full border border-fnred/85 bg-linear-to-r from-fnred/16 via-fnorange/22 to-fnred/16 pl-1 pr-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.07em] text-fnred shadow-[0_0_0_1px_rgba(188,44,26,0.25),0_0_26px_rgba(188,44,26,0.5)] backdrop-blur-sm motion-safe:animate-[pulse-glow_3s_ease-in-out_infinite] sm:py-1 sm:pl-1 sm:pr-3">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
                >
                  <div className="absolute inset-y-0 -left-1/2 w-full bg-linear-to-r from-transparent via-white/55 to-transparent opacity-80 blur-[1px] sm:w-full motion-safe:animate-[line-scan_2.4s_linear_infinite]" />
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-fnred/80 bg-fnred px-2 py-0.5 text-[9px] tracking-[0.2em] text-white">
                  <span className="relative flex size-1.5 overflow-hidden rounded-full">
                    <span className="absolute inset-0 rounded-full bg-white/70 motion-safe:animate-pulse" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-white" />
                  </span>
                  Live
                </span>
                <p className="truncate">
                  Do not use SRM email to sign in.
                  <span className="hidden sm:inline"> Use personal email instead.</span>
                </p>
              </div>
            </div>
          </InView>

          <InView
            once
            transition={HERO_TRANSITION_BASE}
            variants={MOTION_VARIANTS.fadeBlurIn}
          >
            <div className="text-xs sm:text-sm md:text-lg rounded-full px-4 uppercase font-bold tracking-wide bg-fngreen/20 text-fngreen border-2 border-fngreen text-center shadow-[0_0_18px_rgba(0,158,96,0.22)] motion-safe:animate-[float-soft_7s_ease-in-out_infinite]">
              {content.caption}
            </div>
          </InView>

          <InView
            once
            transition={{ ...HERO_TRANSITION_SLOW, delay: 0.08 }}
            variants={HERO_REVEAL_VARIANTS}
          >
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter uppercase text-center text-balance leading-10 md:leading-14">
              {content.heading}{" "}
              <span className="text-fnblue italic">
                {content.headingHighlight}
              </span>
            </h1>
          </InView>

          {/* 
          <div className="relative h-80 w-full overflow-hidden">
            <VideoText
              src="/hero-video/hero-white.mp4"
              as={"h1"}
              // className="text-5xl md:text-7xl font-bold tracking-tighter uppercase text-center text-balance leading-16 w-full"
            >
              Claim the Problem
            </VideoText>
          </div> */}

          <InView
            once
            transition={{ ...HERO_TRANSITION_BASE, delay: 0.14 }}
            variants={MOTION_VARIANTS.fadeBlurIn}
          >
            <p className="text-foreground/80 text-center max-w-3xl text-md md:text-lg font-medium leading-5 md:leading-6">
              {content.description}
            </p>
          </InView>
          <InView
            once
            transition={{ ...HERO_TRANSITION_BASE, delay: 0.2 }}
            variants={HERO_REVEAL_VARIANTS}
          >
            <div className="relative mt-6 flex items-center gap-4 flex-wrap justify-center">
              <div className="pointer-events-none absolute -inset-x-8 -inset-y-6 rounded-full bg-fnblue/14 blur-3xl motion-safe:animate-[pulse-glow_3.4s_ease-in-out_infinite]" />
              <HeroRegisterButton
                initialIsSignedIn={isSignedIn}
                initialTeamId={teamId}
                label={content.primaryButtonText}
              />
              <Magnetic
                intensity={0.1}
                springOptions={springOptions}
                actionArea="global"
                range={200}
              >
                <FnButton
                  asChild
                  tone="gray"
                  size="lg"
                  className="border-fnblue"
                >
                  <Link href="/problem-statements">
                    <Magnetic
                      intensity={0.05}
                      springOptions={springOptions}
                      actionArea="global"
                      range={200}
                    >
                      {content.secondaryButtonText}
                    </Magnetic>
                  </Link>
                </FnButton>
              </Magnetic>
            </div>
          </InView>
        </div>
      </div>
    </section>
  );
};
export default Hero;
