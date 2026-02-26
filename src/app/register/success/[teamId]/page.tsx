"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FnButton } from "@/components/ui/fn-button";
import { InView } from "@/components/ui/in-view";
import { toast } from "@/hooks/use-toast";
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
  const [team, setTeam] = useState<TeamRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        <InView
          once
          transition={{ duration: 0.3, ease: "easeOut" }}
          variants={{
            hidden: { opacity: 0, y: 24, filter: "blur(5px)" },
            visible: { opacity: 1, y: 0, filter: "blur(0px)" },
          }}
        >
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
                team setup
                <span className="text-fnblue"> complete</span>
              </h1>
              <p className="mt-3 text-foreground/70">
                Your team is registered and ready. Continue to dashboard to
                manage team details.
              </p>

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
                <InView
                  once
                  transition={{ duration: 0.2, ease: "easeOut", delay: 0.06 }}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0 },
                  }}
                >
                  <FnButton asChild>
                    <Link href={`/dashboard/${params.teamId}`}>
                      Go To Dashboard
                    </Link>
                  </FnButton>
                </InView>
                <InView
                  once
                  transition={{ duration: 0.2, ease: "easeOut", delay: 0.1 }}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0 },
                  }}
                >
                  <FnButton asChild tone="gray">
                    <Link href="/">Back To Home</Link>
                  </FnButton>
                </InView>
              </div>
            </div>
          </section>
        </InView>
      </div>
    </main>
  );
}
