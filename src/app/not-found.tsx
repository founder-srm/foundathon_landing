import Link from "next/link";
import { FnButton } from "@/components/ui/fn-button";

const links = [
  { label: "Back to Home", href: "/", tone: "blue" as const },
  {
    label: "Problem Statements",
    href: "/problem-statements",
    tone: "gray" as const,
  },
  // { label: "Register Team", href: "/register", tone: "yellow" as const },
];

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="absolute -top-24 -left-24 size-104 rounded-full bg-fnblue/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -right-20 size-112 rounded-full bg-fnyellow/25 blur-3xl pointer-events-none" />
      <div className="absolute top-16 left-1/2 -translate-x-1/2 h-px w-5/6 bg-linear-to-r from-transparent via-fnblue/60 to-transparent animate-pulse pointer-events-none" />

      <div className="fncontainer relative py-20 md:py-28">
        <section className="relative overflow-hidden rounded-3xl border bg-background/95 p-12 md:p-16 shadow-2xl border-b-4 border-fnblue backdrop-blur-sm text-center max-w-5xl mx-auto">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none bg-repeat bg-center"
            style={{ backgroundImage: "url(/textures/noise-main.svg)" }}
          />
          <div className="absolute -top-20 -right-24 size-48 rounded-full bg-fnred/18 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 size-52 rounded-full bg-fngreen/18 blur-3xl pointer-events-none" />

          <div className="relative space-y-6">
            <p className="inline-flex rounded-full border-2 border-fnblue bg-fnblue/30 px-3 text-sm font-extrabold uppercase tracking-wider text-fnblue">
              uh oh! you're off the board
            </p>
            <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none text-balance">
              404 <span className="italic text-fnblue">hotwire</span>
            </h1>
            <p className="text-lg md:text-xl text-foreground/80 max-w-3xl mx-auto font-medium">
              This square doesn’t exist. Jump back to a live tile and keep your
              momentum.
            </p>

            <div className="flex flex-wrap justify-center gap-3 md:gap-4 pt-2">
              {links.map((item) => (
                <FnButton asChild key={item.href} tone={item.tone} size="lg">
                  <Link href={item.href}>{item.label}</Link>
                </FnButton>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
