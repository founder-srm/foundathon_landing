const LoadingLine = ({ className }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-md bg-foreground/10 ${
      className ?? "h-4 w-full"
    }`}
  />
);

export default function TeamDashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-100 text-foreground">
      <div className="fncontainer relative py-10 md:py-14">
        <div className="h-8 w-56 animate-pulse rounded-md bg-foreground/10" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded-md bg-foreground/10" />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="h-24 animate-pulse rounded-xl border border-foreground/10 bg-background/90" />
          <div className="h-24 animate-pulse rounded-xl border border-foreground/10 bg-background/90" />
          <div className="h-24 animate-pulse rounded-xl border border-foreground/10 bg-background/90" />
          <div className="h-24 animate-pulse rounded-xl border border-foreground/10 bg-background/90" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <section className="rounded-xl border border-foreground/10 bg-background/95 p-6 md:p-8 shadow-sm">
            <LoadingLine className="h-6 w-40" />
            <LoadingLine className="mt-3 h-4 w-72" />
            <LoadingLine className="mt-6 h-16" />
            <LoadingLine className="mt-4 h-20" />
            <LoadingLine className="mt-4 h-20" />
            <div className="mt-6 flex gap-3">
              <LoadingLine className="h-10 w-28" />
              <LoadingLine className="h-10 w-36" />
              <LoadingLine className="h-10 w-32" />
            </div>
          </section>

          <aside className="space-y-4 self-start">
            <div className="rounded-xl border border-foreground/10 bg-background/95 p-6 shadow-sm">
              <LoadingLine className="h-5 w-44" />
              <div className="mt-4 space-y-3">
                <LoadingLine className="h-10" />
                <LoadingLine className="h-10" />
                <LoadingLine className="h-10" />
              </div>
            </div>

            <div className="rounded-xl border border-foreground/10 bg-background/95 p-6 shadow-sm">
              <LoadingLine className="h-5 w-32" />
              <div className="mt-4 space-y-2">
                <LoadingLine className="h-9" />
                <LoadingLine className="h-9" />
                <LoadingLine className="h-9" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
