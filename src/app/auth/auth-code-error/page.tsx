import Link from "next/link";
import { FnButton } from "@/components/ui/fn-button";

export default function AuthCodeErrorPage() {
  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-45 pointer-events-none"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="fncontainer relative py-16 md:py-24">
        <section className="mx-auto max-w-2xl rounded-2xl border border-b-4 border-fnred bg-background/95 p-8 shadow-xl">
          <p className="inline-flex rounded-full border border-fnred/35 bg-fnred/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-fnred">
            Authentication Error
          </p>
          <h1 className="mt-4 text-3xl font-black uppercase tracking-tight md:text-4xl">
            sign in could not be completed
          </h1>
          <p className="mt-3 text-sm text-foreground/75 md:text-base">
            We could not complete your login session. Please try signing in
            again. If this keeps happening, clear browser cookies for this site
            and retry.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <FnButton asChild>
              <Link href="/api/auth/login">Try Sign In Again</Link>
            </FnButton>
            <FnButton asChild tone="gray">
              <Link href="/">Back to Home</Link>
            </FnButton>
          </div>
        </section>
      </div>
    </main>
  );
}
