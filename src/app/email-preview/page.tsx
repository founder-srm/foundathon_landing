import type { Metadata } from "next";
import { EmailTemplate } from "@/components/email-template";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Email Preview",
};

const PREVIEW_PROPS = {
  ctaBaseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  leadEmail: "lead@example.com",
  leadName: "Alex Johnson",
  lockExpiresAtIso: "2026-02-21T18:30:00.000Z",
  lockedAtIso: "2026-02-21T18:00:00.000Z",
  problemStatementId: "FN-PS-014",
  problemStatementSummary:
    "Build a scalable model to help early-stage founders validate product-market fit with measurable indicators.",
  problemStatementTitle:
    "Founder Validation Intelligence for Early-Stage Product Teams",
  teamName: "Catalyst Crew",
} as const;

export default function EmailPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-200 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4">
        <section className="rounded-2xl border border-foreground/15 bg-background p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fnblue">
            Local Preview
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">
            Problem Statement Lock Email
          </h1>
          <p className="mt-2 text-sm text-foreground/75">
            Preview only. No email provider call is made on this page.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10">
            <EmailTemplate
              {...PREVIEW_PROPS}
              notificationType="lock_confirmed"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-foreground/15 bg-background p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fnred">
            Local Preview
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">
            Registration Abandonment Email
          </h2>
          <p className="mt-2 text-sm text-foreground/75">
            This is the abandoned flow variant with lock release messaging.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10">
            <EmailTemplate
              {...PREVIEW_PROPS}
              abandonedAtIso="2026-02-21T18:10:00.000Z"
              notificationType="lock_abandoned"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
