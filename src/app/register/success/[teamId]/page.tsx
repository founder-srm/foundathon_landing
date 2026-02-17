"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FnButton } from "@/components/ui/fn-button";
import { toast } from "@/hooks/use-toast";
import { getProblemReleaseCountdown } from "@/lib/problem-release-countdown";
import type { TeamRecord } from "@/lib/register-schema";

const SummaryValue = ({
  isLoading,
  value,
}: {
  isLoading: boolean;
  value: string;
}) => {
  if (isLoading) {
    return <div className="mt-1 h-5 w-40 animate-pulse rounded bg-fnblue/25" />;
  }

  return <p className="mt-1 text-sm font-bold md:text-base">{value}</p>;
};

export default function RegistrationSuccessPage() {
  const params = useParams<{ teamId: string }>();
  const [time, setTime] = useState(() => getProblemReleaseCountdown());
  const [team, setTeam] = useState<TeamRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const id = window.setInterval(
      () => setTime(getProblemReleaseCountdown()),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchTeam = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/register/${params.teamId}`);
        const data = (await res.json()) as {
          team?: TeamRecord;
          error?: string;
        };

        if (!res.ok || !data.team) {
          toast({
            title: "Unable to Load Team Summary",
            description:
              data.error ??
              "Your registration was successful, but we couldn't fetch team details right now.",
            variant: "destructive",
          });
          return;
        }

        setTeam(data.team);
      } catch (error) {
        toast({
          title: "Team Summary Request Failed",
          description:
            error instanceof Error
              ? error.message
              : "Network issue while loading your registered team details. Please refresh and try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeam();
  }, [params.teamId]);

  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-45 pointer-events-none"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="absolute -top-24 -right-16 size-80 rounded-full bg-fngreen/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-fnblue/20 blur-3xl pointer-events-none" />
      <div className="fncontainer relative py-16 md:py-24">
        <section className="rounded-2xl border bg-background/95 p-8 md:p-10 shadow-xl border-b-4 border-fngreen relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none bg-repeat bg-center"
            style={{ backgroundImage: "url(/textures/noise-main.svg)" }}
          />
          <div className="relative">
            <p className="inline-flex rounded-full border-2 border-fngreen bg-fngreen/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-fngreen">
              Team Created Successfully
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex rounded-md border border-fnblue/30 bg-fnblue/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-fnblue">
                Onboarding Complete
              </span>
              <span className="inline-flex rounded-md border border-fnyellow/40 bg-fnyellow/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
                Next: Manage Team
              </span>
            </div>
            <h1 className="mt-4 text-4xl md:text-6xl font-black uppercase tracking-tight">
              get ready for
              <span className="text-fnblue"> release</span>
            </h1>
            <p className="mt-3 text-foreground/70">
              Your team is registered. Countdown to problem statement release is
              live.
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
                  className="rounded-xl border bg-linear-to-b from-gray-100 to-gray-50 border-b-4 border-fnyellow p-5 text-center shadow-md"
                >
                  <p className="text-5xl md:text-7xl font-black text-fnblue leading-none">
                    {item.value}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground/70 mt-2">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-fnblue/25 bg-fnblue/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] font-semibold text-fnblue">
                Team Name
              </p>
              <SummaryValue
                isLoading={isLoading}
                value={team?.teamName ?? "N/A"}
              />
            </div>

            <div className="mt-4 rounded-xl border border-fnblue/25 bg-fnblue/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] font-semibold text-fnblue">
                Lead Name
              </p>
              <SummaryValue
                isLoading={isLoading}
                value={team?.lead.name ?? "N/A"}
              />
            </div>

            <div className="mt-4 rounded-xl border border-fnblue/25 bg-fnblue/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] font-semibold text-fnblue">
                Total Members
              </p>
              <SummaryValue
                isLoading={isLoading}
                value={team ? `${team.members.length + 1}` : "N/A"}
              />
            </div>

            <div className="mt-6 rounded-xl border border-fnblue/25 bg-fnblue/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] font-semibold text-fnblue">
                Registered Team ID
              </p>
              <p className="text-sm md:text-base font-bold mt-1 break-all">
                {params.teamId}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <FnButton asChild>
                <Link href={`/team/${params.teamId}`}>
                  Go To Team Dashboard
                </Link>
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
